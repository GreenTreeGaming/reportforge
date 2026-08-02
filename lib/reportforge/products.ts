import type {
    CleanSalesRow,
    ComparisonWindow,
    ProductMomentum,
    ProductMomentumResult,
} from "./types";

type ProductPeriodStats = {
    revenue: number;
    salesRevenue: number;
    returnedRevenue: number;
    orders: Set<string>;
    customers: Set<string>;
};

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;

function findTimestampBounds(
    rows: CleanSalesRow[],
): {
    earliest: number;
    latest: number;
} | null {
    let earliest = Infinity;
    let latest = -Infinity;

    for (const row of rows) {
        const timestamp =
            new Date(row.date).getTime();

        if (!Number.isFinite(timestamp)) {
            continue;
        }

        if (timestamp < earliest) {
            earliest = timestamp;
        }

        if (timestamp > latest) {
            latest = timestamp;
        }
    }

    if (
        earliest === Infinity ||
        latest === -Infinity
    ) {
        return null;
    }

    return {
        earliest,
        latest,
    };
}

function startOfUtcDay(
    value: Date,
): Date {
    return new Date(
        Date.UTC(
            value.getUTCFullYear(),
            value.getUTCMonth(),
            value.getUTCDate(),
        ),
    );
}

function addDays(
    value: Date,
    days: number,
): Date {
    return new Date(
        value.getTime() +
        days * DAY_MS,
    );
}

function isoDateOnly(
    value: Date,
): string {
    return value
        .toISOString()
        .slice(0, 10);
}

function getComparisonWindow(
    rows: CleanSalesRow[],
    requestedWindowDays =
    DEFAULT_WINDOW_DAYS,
): ComparisonWindow | null {
    if (rows.length === 0) {
        return null;
    }

    const bounds =
        findTimestampBounds(rows);

    if (!bounds) {
        return null;
    }

    const earliest = startOfUtcDay(
        new Date(bounds.earliest),
    );

    const latest = startOfUtcDay(
        new Date(bounds.latest),
    );

    const availableDays =
        Math.floor(
            (
                latest.getTime() -
                earliest.getTime()
            ) / DAY_MS,
        ) + 1;

    if (availableDays < 2) {
        return null;
    }

    const windowDays = Math.max(
        1,
        Math.min(
            requestedWindowDays,
            Math.floor(
                availableDays / 2,
            ),
        ),
    );

    const currentEnd = latest;

    const currentStart = addDays(
        currentEnd,
        -(windowDays - 1),
    );

    const previousEnd = addDays(
        currentStart,
        -1,
    );

    const previousStart = addDays(
        previousEnd,
        -(windowDays - 1),
    );

    return {
        currentStart:
            isoDateOnly(currentStart),
        currentEnd:
            isoDateOnly(currentEnd),
        previousStart:
            isoDateOnly(previousStart),
        previousEnd:
            isoDateOnly(previousEnd),
        windowDays,
    };
}

function inRange(
    date: string,
    start: string,
    end: string,
): boolean {
    const dateOnly = date.slice(0, 10);

    return (
        dateOnly >= start &&
        dateOnly <= end
    );
}

function createStats():
    ProductPeriodStats {
    return {
        revenue: 0,
        salesRevenue: 0,
        returnedRevenue: 0,
        orders: new Set<string>(),
        customers: new Set<string>(),
    };
}

function aggregateProducts(
    rows: CleanSalesRow[],
): Map<
    string,
    ProductPeriodStats
> {
    const totals =
        new Map<
            string,
            ProductPeriodStats
        >();

    for (const row of rows) {
        const stats =
            totals.get(row.product) ??
            createStats();

        stats.revenue += row.revenue;

        if (row.revenue >= 0) {
            stats.salesRevenue +=
                row.revenue;
        } else {
            stats.returnedRevenue +=
                Math.abs(row.revenue);
        }

        if (row.orderId) {
            stats.orders.add(
                row.orderId,
            );
        }

        if (row.customer) {
            stats.customers.add(
                row.customer,
            );
        }

        totals.set(
            row.product,
            stats,
        );
    }

    return totals;
}

function classifyMomentum(
    currentRevenue: number,
    previousRevenue: number,
): ProductMomentum["status"] {
    if (
        currentRevenue > 0 &&
        previousRevenue === 0
    ) {
        return "new";
    }

    if (
        currentRevenue === 0 &&
        previousRevenue > 0
    ) {
        return "inactive";
    }

    if (
        currentRevenue === 0 &&
        previousRevenue === 0
    ) {
        return "stable";
    }

    const changeRate =
        previousRevenue === 0
            ? null
            : (
                currentRevenue -
                previousRevenue
            ) /
            Math.abs(
                previousRevenue,
            );

    if (
        changeRate !== null &&
        changeRate >= 0.15
    ) {
        return "growing";
    }

    if (
        changeRate !== null &&
        changeRate <= -0.15
    ) {
        return "declining";
    }

    return "stable";
}

export function calculateProductMomentum(
    rows: CleanSalesRow[],
    requestedWindowDays =
    DEFAULT_WINDOW_DAYS,
): ProductMomentumResult {
    const window =
        getComparisonWindow(
            rows,
            requestedWindowDays,
        );

    if (!window) {
        return {
            window: null,
            products: [],
            fastestGrowing: [],
            fastestDeclining: [],
            newlyActive: [],
            becameInactive: [],
        };
    }

    const currentRows = rows.filter(
        (row) =>
            inRange(
                row.date,
                window.currentStart,
                window.currentEnd,
            ),
    );

    const previousRows = rows.filter(
        (row) =>
            inRange(
                row.date,
                window.previousStart,
                window.previousEnd,
            ),
    );

    const current =
        aggregateProducts(
            currentRows,
        );

    const previous =
        aggregateProducts(
            previousRows,
        );

    const products = new Set([
        ...current.keys(),
        ...previous.keys(),
    ]);

    const totalCurrentRevenue =
        currentRows.reduce(
            (total, row) =>
                total + row.revenue,
            0,
        );

    const results: ProductMomentum[] =
        [...products].map(
            (product) => {
                const currentStats =
                    current.get(product) ??
                    createStats();

                const previousStats =
                    previous.get(product) ??
                    createStats();

                const revenueChange =
                    currentStats.revenue -
                    previousStats.revenue;

                const revenueChangeRate =
                    previousStats.revenue ===
                    0
                        ? null
                        : revenueChange /
                        Math.abs(
                            previousStats.revenue,
                        );

                const currentReturnRate =
                    currentStats
                        .salesRevenue === 0
                        ? 0
                        : currentStats
                            .returnedRevenue /
                        currentStats
                            .salesRevenue;

                return {
                    product,
                    status:
                        classifyMomentum(
                            currentStats.revenue,
                            previousStats.revenue,
                        ),

                    currentRevenue:
                    currentStats.revenue,

                    previousRevenue:
                    previousStats.revenue,

                    revenueChange,
                    revenueChangeRate,

                    currentOrders:
                    currentStats.orders.size,

                    previousOrders:
                    previousStats.orders.size,

                    orderChange:
                        currentStats.orders.size -
                        previousStats.orders.size,

                    currentCustomers:
                    currentStats.customers
                        .size,

                    previousCustomers:
                    previousStats.customers
                        .size,

                    currentReturnedRevenue:
                    currentStats
                        .returnedRevenue,

                    currentReturnRate,

                    shareOfCurrentRevenue:
                        totalCurrentRevenue === 0
                            ? 0
                            : currentStats.revenue /
                            totalCurrentRevenue,
                };
            },
        );

    const fastestGrowing = results
        .filter(
            (product) =>
                product.status ===
                "growing",
        )
        .sort(
            (left, right) =>
                right.revenueChange -
                left.revenueChange,
        )
        .slice(0, 20);

    const fastestDeclining = results
        .filter(
            (product) =>
                product.status ===
                "declining",
        )
        .sort(
            (left, right) =>
                left.revenueChange -
                right.revenueChange,
        )
        .slice(0, 20);

    const newlyActive = results
        .filter(
            (product) =>
                product.status === "new",
        )
        .sort(
            (left, right) =>
                right.currentRevenue -
                left.currentRevenue,
        )
        .slice(0, 20);

    const becameInactive = results
        .filter(
            (product) =>
                product.status ===
                "inactive",
        )
        .sort(
            (left, right) =>
                right.previousRevenue -
                left.previousRevenue,
        )
        .slice(0, 20);

    return {
        window,
        products: results.sort(
            (left, right) =>
                right.currentRevenue -
                left.currentRevenue,
        ),
        fastestGrowing,
        fastestDeclining,
        newlyActive,
        becameInactive,
    };
}