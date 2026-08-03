import type {
    CleanSalesRow,
    ComparisonWindow,
    CustomerMovementResult,
    KpiComparison,
    PerformanceAnalytics,
    PeriodPerformance,
    RevenueBridgeStep,
    RevenueDriver,
} from "./types";

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;

function dateOnly(value: string): string {
    return value.slice(0, 10);
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
}

function comparisonWindow(
    rows: CleanSalesRow[],
    requestedWindowDays = DEFAULT_WINDOW_DAYS,
): ComparisonWindow | null {
    const timestamps = rows
        .map((row) => new Date(row.date).getTime())
        .filter(Number.isFinite);

    if (timestamps.length === 0) {
        return null;
    }

    const earliestValue = Math.min(...timestamps);
    const latestValue = Math.max(...timestamps);
    const earliestSource = new Date(earliestValue);
    const latestSource = new Date(latestValue);

    const earliest = new Date(Date.UTC(
        earliestSource.getUTCFullYear(),
        earliestSource.getUTCMonth(),
        earliestSource.getUTCDate(),
    ));

    const latest = new Date(Date.UTC(
        latestSource.getUTCFullYear(),
        latestSource.getUTCMonth(),
        latestSource.getUTCDate(),
    ));

    const availableDays = Math.floor(
        (latest.getTime() - earliest.getTime()) / DAY_MS,
    ) + 1;

    if (availableDays < 2) {
        return null;
    }

    const windowDays = Math.max(
        1,
        Math.min(requestedWindowDays, Math.floor(availableDays / 2)),
    );

    const currentEnd = latest;
    const currentStart = addDays(currentEnd, -(windowDays - 1));
    const previousEnd = addDays(currentStart, -1);
    const previousStart = addDays(previousEnd, -(windowDays - 1));

    return {
        currentStart: dateOnly(currentStart.toISOString()),
        currentEnd: dateOnly(currentEnd.toISOString()),
        previousStart: dateOnly(previousStart.toISOString()),
        previousEnd: dateOnly(previousEnd.toISOString()),
        windowDays,
    };
}

function inRange(date: string, start: string, end: string): boolean {
    const value = dateOnly(date);
    return value >= start && value <= end;
}

function aggregatePeriod(rows: CleanSalesRow[]): PeriodPerformance {
    let revenue = 0;
    let customerRevenue = 0;
    const orders = new Set<string>();
    const customers = new Set<string>();
    const customerOrders = new Set<string>();

    for (const row of rows) {
        revenue += row.revenue;

        const orderKey = row.orderId ?? `row:${row.sourceRow}`;
        orders.add(orderKey);

        if (row.customer) {
            customers.add(row.customer);
            customerOrders.add(orderKey);
            customerRevenue += row.revenue;
        }
    }

    const orderCount = orders.size;
    const activeCustomers = customers.size;
    const customerOrderCount = customerOrders.size;

    return {
        revenue,
        orders: orderCount,
        averageOrderValue: orderCount === 0 ? 0 : revenue / orderCount,
        activeCustomers,
        customerAttributedRevenue: customerRevenue,
        customerAttributedOrders: customerOrderCount,
        ordersPerCustomer:
            activeCustomers === 0 ? 0 : customerOrderCount / activeCustomers,
        customerAverageOrderValue:
            customerOrderCount === 0 ? 0 : customerRevenue / customerOrderCount,
    };
}

function changeRate(current: number, previous: number): number | null {
    if (previous === 0) {
        return null;
    }

    return (current - previous) / Math.abs(previous);
}

function comparison(
    current: number,
    previous: number,
): KpiComparison {
    return {
        current,
        previous,
        absoluteChange: current - previous,
        changeRate: changeRate(current, previous),
    };
}

function buildBridge(
    current: PeriodPerformance,
    previous: PeriodPerformance,
    movement: CustomerMovementResult,
): RevenueBridgeStep[] {
    const totals = movement.totals;
    const knownMovement =
        totals.newRevenue +
        totals.expansionRevenue +
        totals.returningRevenue -
        totals.contractionRevenue -
        totals.lostRevenue;

    const totalChange = current.revenue - previous.revenue;
    const residual = totalChange - knownMovement;

    const steps: RevenueBridgeStep[] = [
        {
            id: "previous",
            label: "Previous revenue",
            kind: "total",
            value: previous.revenue,
        },
        {
            id: "new",
            label: "New customers",
            kind: "increase",
            value: totals.newRevenue,
        },
        {
            id: "expansion",
            label: "Customer expansion",
            kind: "increase",
            value: totals.expansionRevenue,
        },
        {
            id: "returning",
            label: "Returning customers",
            kind: "increase",
            value: totals.returningRevenue,
        },
        {
            id: "contraction",
            label: "Customer contraction",
            kind: "decrease",
            value: -totals.contractionRevenue,
        },
        {
            id: "lost",
            label: "Lost customers",
            kind: "decrease",
            value: -totals.lostRevenue,
        },
    ];

    if (Math.abs(residual) > 0.005) {
        steps.push({
            id: "other",
            label: "Unattributed / other",
            kind: residual >= 0 ? "increase" : "decrease",
            value: residual,
        });
    }

    steps.push({
        id: "current",
        label: "Current revenue",
        kind: "total",
        value: current.revenue,
    });

    return steps;
}

function buildDrivers(
    current: PeriodPerformance,
    previous: PeriodPerformance,
): RevenueDriver[] {
    const previousCustomers = previous.activeCustomers;
    const currentCustomers = current.activeCustomers;
    const previousFrequency = previous.ordersPerCustomer;
    const currentFrequency = current.ordersPerCustomer;
    const previousAov = previous.customerAverageOrderValue;
    const currentAov = current.customerAverageOrderValue;

    const customerEffect =
        (currentCustomers - previousCustomers) *
        previousFrequency *
        previousAov;

    const frequencyEffect =
        currentCustomers *
        (currentFrequency - previousFrequency) *
        previousAov;

    const aovEffect =
        currentCustomers *
        currentFrequency *
        (currentAov - previousAov);

    const previousUnattributed =
        previous.revenue - previous.customerAttributedRevenue;
    const currentUnattributed =
        current.revenue - current.customerAttributedRevenue;
    const unattributedEffect = currentUnattributed - previousUnattributed;

    const drivers: RevenueDriver[] = [
        {
            id: "customers",
            label: "Active customers",
            contribution: customerEffect,
            previousValue: previousCustomers,
            currentValue: currentCustomers,
            valueChangeRate: changeRate(currentCustomers, previousCustomers),
        },
        {
            id: "frequency",
            label: "Orders per customer",
            contribution: frequencyEffect,
            previousValue: previousFrequency,
            currentValue: currentFrequency,
            valueChangeRate: changeRate(currentFrequency, previousFrequency),
        },
        {
            id: "aov",
            label: "Customer average order value",
            contribution: aovEffect,
            previousValue: previousAov,
            currentValue: currentAov,
            valueChangeRate: changeRate(currentAov, previousAov),
        },
    ];

    if (Math.abs(unattributedEffect) > 0.005) {
        drivers.push({
            id: "unattributed",
            label: "Revenue without customer IDs",
            contribution: unattributedEffect,
            previousValue: previousUnattributed,
            currentValue: currentUnattributed,
            valueChangeRate: changeRate(currentUnattributed, previousUnattributed),
        });
    }

    return drivers.sort(
        (left, right) =>
            Math.abs(right.contribution) - Math.abs(left.contribution),
    );
}

export function calculatePerformanceAnalytics(
    rows: CleanSalesRow[],
    customerMovement: CustomerMovementResult,
    requestedWindowDays = DEFAULT_WINDOW_DAYS,
): PerformanceAnalytics {
    const window = comparisonWindow(rows, requestedWindowDays);

    if (!window) {
        return {
            window: null,
            current: null,
            previous: null,
            kpis: null,
            revenueBridge: [],
            revenueDrivers: [],
            customerCoverage: 0,
        };
    }

    const currentRows = rows.filter((row) =>
        inRange(row.date, window.currentStart, window.currentEnd),
    );

    const previousRows = rows.filter((row) =>
        inRange(row.date, window.previousStart, window.previousEnd),
    );

    const current = aggregatePeriod(currentRows);
    const previous = aggregatePeriod(previousRows);
    const periodRevenue = current.revenue + previous.revenue;
    const customerRevenue =
        current.customerAttributedRevenue +
        previous.customerAttributedRevenue;

    return {
        window,
        current,
        previous,
        kpis: {
            revenue: comparison(current.revenue, previous.revenue),
            orders: comparison(current.orders, previous.orders),
            averageOrderValue: comparison(
                current.averageOrderValue,
                previous.averageOrderValue,
            ),
            activeCustomers: comparison(
                current.activeCustomers,
                previous.activeCustomers,
            ),
        },
        revenueBridge: buildBridge(current, previous, customerMovement),
        revenueDrivers: buildDrivers(current, previous),
        customerCoverage:
            periodRevenue === 0 ? 0 : customerRevenue / periodRevenue,
    };
}
