import type {
    CleanSalesRow,
    ComparisonWindow,
    CustomerMovement,
    CustomerMovementResult,
    CustomerMovementStatus,
    RfmCustomer,
    RfmResult,
    RfmSegment,
    RfmSegmentSummary,
} from "./types";

type CustomerPeriodStats = {
    revenue: number;
    orders: Set<string>;
    products: Set<string>;
};

type CustomerLifetimeStats = {
    firstPurchase: string;
    lastPurchase: string;
    revenue: number;
    orders: Set<string>;
};

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 90;

function getDateOnly(
    value: string,
): string {
    return value.slice(0, 10);
}

function addDays(
    date: Date,
    days: number,
): Date {
    return new Date(
        date.getTime() +
        days * DAY_MS,
    );
}

function findTimestampBounds(
    rows: CleanSalesRow[],
): {
    earliest: number;
    latest: number;
} | null {
    let earliest = Infinity;
    let latest = -Infinity;

    for (const row of rows) {
        if (!row.customer) {
            continue;
        }

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

function getComparisonWindow(
    rows: CleanSalesRow[],
    requestedWindowDays =
    DEFAULT_WINDOW_DAYS,
): ComparisonWindow | null {
    const bounds =
        findTimestampBounds(rows);

    if (!bounds) {
        return null;
    }

    const earliest =
        new Date(bounds.earliest);

    const latest =
        new Date(bounds.latest);

    const earliestDay =
        new Date(
            Date.UTC(
                earliest.getUTCFullYear(),
                earliest.getUTCMonth(),
                earliest.getUTCDate(),
            ),
        );

    const latestDay =
        new Date(
            Date.UTC(
                latest.getUTCFullYear(),
                latest.getUTCMonth(),
                latest.getUTCDate(),
            ),
        );

    const availableDays =
        Math.floor(
            (
                latestDay.getTime() -
                earliestDay.getTime()
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

    const currentEnd = latestDay;

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
            getDateOnly(
                currentStart.toISOString(),
            ),
        currentEnd:
            getDateOnly(
                currentEnd.toISOString(),
            ),
        previousStart:
            getDateOnly(
                previousStart.toISOString(),
            ),
        previousEnd:
            getDateOnly(
                previousEnd.toISOString(),
            ),
        windowDays,
    };
}

function inRange(
    date: string,
    start: string,
    end: string,
): boolean {
    const value =
        getDateOnly(date);

    return (
        value >= start &&
        value <= end
    );
}

function createPeriodStats():
    CustomerPeriodStats {
    return {
        revenue: 0,
        orders: new Set<string>(),
        products: new Set<string>(),
    };
}

function aggregateCustomers(
    rows: CleanSalesRow[],
): Map<
    string,
    CustomerPeriodStats
> {
    const customers =
        new Map<
            string,
            CustomerPeriodStats
        >();

    for (const row of rows) {
        if (!row.customer) {
            continue;
        }

        const stats =
            customers.get(
                row.customer,
            ) ??
            createPeriodStats();

        stats.revenue +=
            row.revenue;

        stats.products.add(
            row.product,
        );

        stats.orders.add(
            row.orderId ??
            `row:${row.sourceRow}`,
        );

        customers.set(
            row.customer,
            stats,
        );
    }

    return customers;
}

function lifetimeCustomers(
    rows: CleanSalesRow[],
): Map<
    string,
    CustomerLifetimeStats
> {
    const customers =
        new Map<
            string,
            CustomerLifetimeStats
        >();

    for (const row of rows) {
        if (!row.customer) {
            continue;
        }

        const existing =
            customers.get(
                row.customer,
            );

        const orderKey =
            row.orderId ??
            `row:${row.sourceRow}`;

        if (!existing) {
            customers.set(
                row.customer,
                {
                    firstPurchase:
                    row.date,
                    lastPurchase:
                    row.date,
                    revenue:
                    row.revenue,
                    orders:
                        new Set([
                            orderKey,
                        ]),
                },
            );

            continue;
        }

        existing.revenue +=
            row.revenue;

        existing.orders.add(
            orderKey,
        );

        if (
            row.date <
            existing.firstPurchase
        ) {
            existing.firstPurchase =
                row.date;
        }

        if (
            row.date >
            existing.lastPurchase
        ) {
            existing.lastPurchase =
                row.date;
        }
    }

    return customers;
}

function classifyMovement(
    currentRevenue: number,
    previousRevenue: number,
    firstPurchase: string,
    window: ComparisonWindow,
): CustomerMovementStatus {
    const firstPurchaseDate =
        getDateOnly(
            firstPurchase,
        );

    if (
        currentRevenue !== 0 &&
        previousRevenue === 0
    ) {
        return firstPurchaseDate >=
        window.currentStart
            ? "new"
            : "returning";
    }

    if (
        currentRevenue === 0 &&
        previousRevenue !== 0
    ) {
        return "lost";
    }

    if (
        currentRevenue === 0 &&
        previousRevenue === 0
    ) {
        return "retained";
    }

    const changeRate =
        (
            currentRevenue -
            previousRevenue
        ) /
        Math.max(
            Math.abs(
                previousRevenue,
            ),
            1,
        );

    if (changeRate >= 0.15) {
        return "expanded";
    }

    if (changeRate <= -0.15) {
        return "contracted";
    }

    return "retained";
}

export function calculateCustomerMovement(
    rows: CleanSalesRow[],
    requestedWindowDays =
    DEFAULT_WINDOW_DAYS,
): CustomerMovementResult {
    const window =
        getComparisonWindow(
            rows,
            requestedWindowDays,
        );

    const emptyResult: CustomerMovementResult =
        {
            window: null,
            customers: [],
            totals: {
                newRevenue: 0,
                retainedRevenue: 0,
                expansionRevenue: 0,
                contractionRevenue: 0,
                returningRevenue: 0,
                lostRevenue: 0,
            },
            newCustomers: [],
            expandedCustomers: [],
            contractedCustomers: [],
            returningCustomers: [],
            lostCustomers: [],
        };

    if (!window) {
        return emptyResult;
    }

    const currentRows = rows.filter(
        (row) =>
            row.customer &&
            inRange(
                row.date,
                window.currentStart,
                window.currentEnd,
            ),
    );

    const previousRows = rows.filter(
        (row) =>
            row.customer &&
            inRange(
                row.date,
                window.previousStart,
                window.previousEnd,
            ),
    );

    const current =
        aggregateCustomers(
            currentRows,
        );

    const previous =
        aggregateCustomers(
            previousRows,
        );

    const lifetime =
        lifetimeCustomers(rows);

    const customerIds =
        new Set([
            ...current.keys(),
            ...previous.keys(),
        ]);

    const customers: CustomerMovement[] =
        [...customerIds].map(
            (customer) => {
                const currentStats =
                    current.get(
                        customer,
                    ) ??
                    createPeriodStats();

                const previousStats =
                    previous.get(
                        customer,
                    ) ??
                    createPeriodStats();

                const lifetimeStats =
                    lifetime.get(
                        customer,
                    );

                const revenueChange =
                    currentStats.revenue -
                    previousStats.revenue;

                return {
                    customer,
                    status:
                        classifyMovement(
                            currentStats.revenue,
                            previousStats.revenue,
                            lifetimeStats
                                ?.firstPurchase ??
                            window.currentStart,
                            window,
                        ),

                    currentRevenue:
                    currentStats.revenue,

                    previousRevenue:
                    previousStats.revenue,

                    revenueChange,

                    revenueChangeRate:
                        previousStats.revenue ===
                        0
                            ? null
                            : revenueChange /
                            Math.abs(
                                previousStats.revenue,
                            ),

                    currentOrders:
                    currentStats.orders
                        .size,

                    previousOrders:
                    previousStats.orders
                        .size,

                    currentProducts:
                    currentStats.products
                        .size,

                    previousProducts:
                    previousStats.products
                        .size,

                    firstPurchase:
                        lifetimeStats
                            ?.firstPurchase ??
                        window.currentStart,

                    lastPurchase:
                        lifetimeStats
                            ?.lastPurchase ??
                        window.currentEnd,
                };
            },
        );

    const totals = {
        newRevenue: 0,
        retainedRevenue: 0,
        expansionRevenue: 0,
        contractionRevenue: 0,
        returningRevenue: 0,
        lostRevenue: 0,
    };

    for (const customer of customers) {
        switch (customer.status) {
            case "new":
                totals.newRevenue +=
                    customer.currentRevenue;
                break;

            case "retained":
                totals.retainedRevenue +=
                    customer.currentRevenue;
                break;

            case "expanded":
                totals.retainedRevenue +=
                    customer.previousRevenue;

                totals.expansionRevenue +=
                    Math.max(
                        customer.revenueChange,
                        0,
                    );
                break;

            case "contracted":
                totals.retainedRevenue +=
                    customer.currentRevenue;

                totals.contractionRevenue +=
                    Math.abs(
                        Math.min(
                            customer.revenueChange,
                            0,
                        ),
                    );
                break;

            case "returning":
                totals.returningRevenue +=
                    customer.currentRevenue;
                break;

            case "lost":
                totals.lostRevenue +=
                    Math.abs(
                        customer.previousRevenue,
                    );
                break;
        }
    }

    return {
        window,
        customers,

        totals,

        newCustomers:
            customers
                .filter(
                    (customer) =>
                        customer.status ===
                        "new",
                )
                .sort(
                    (left, right) =>
                        right.currentRevenue -
                        left.currentRevenue,
                )
                .slice(0, 25),

        expandedCustomers:
            customers
                .filter(
                    (customer) =>
                        customer.status ===
                        "expanded",
                )
                .sort(
                    (left, right) =>
                        right.revenueChange -
                        left.revenueChange,
                )
                .slice(0, 25),

        contractedCustomers:
            customers
                .filter(
                    (customer) =>
                        customer.status ===
                        "contracted",
                )
                .sort(
                    (left, right) =>
                        left.revenueChange -
                        right.revenueChange,
                )
                .slice(0, 25),

        returningCustomers:
            customers
                .filter(
                    (customer) =>
                        customer.status ===
                        "returning",
                )
                .sort(
                    (left, right) =>
                        right.currentRevenue -
                        left.currentRevenue,
                )
                .slice(0, 25),

        lostCustomers:
            customers
                .filter(
                    (customer) =>
                        customer.status ===
                        "lost",
                )
                .sort(
                    (left, right) =>
                        right.previousRevenue -
                        left.previousRevenue,
                )
                .slice(0, 25),
    };
}

function quantileScore(
    value: number,
    sortedValues: number[],
    higherIsBetter: boolean,
): number {
    if (
        sortedValues.length === 0
    ) {
        return 1;
    }

    let lessOrEqual = 0;

    for (const candidate of sortedValues) {
        if (candidate <= value) {
            lessOrEqual += 1;
        }
    }

    const percentile =
        lessOrEqual /
        sortedValues.length;

    const score = Math.min(
        5,
        Math.max(
            1,
            Math.ceil(
                percentile * 5,
            ),
        ),
    );

    return higherIsBetter
        ? score
        : 6 - score;
}

function classifyRfmSegment(
    recency: number,
    frequency: number,
    monetary: number,
): RfmSegment {
    if (
        recency >= 4 &&
        frequency >= 4 &&
        monetary >= 4
    ) {
        return "champions";
    }

    if (
        frequency >= 4 &&
        monetary >= 3
    ) {
        return "loyal";
    }

    if (
        recency >= 4 &&
        frequency >= 2
    ) {
        return "potential_loyalists";
    }

    if (
        recency === 5 &&
        frequency <= 2
    ) {
        return "new_customers";
    }

    if (
        recency >= 3 &&
        frequency <= 2
    ) {
        return "promising";
    }

    if (
        recency <= 2 &&
        frequency >= 3 &&
        monetary >= 3
    ) {
        return "at_risk";
    }

    if (
        recency <= 2 &&
        frequency <= 2
    ) {
        return "hibernating";
    }

    return "need_attention";
}

export function calculateRfm(
    rows: CleanSalesRow[],
): RfmResult {
    const lifetime =
        lifetimeCustomers(rows);

    if (lifetime.size === 0) {
        return {
            analysisDate: null,
            customers: [],
            segments: [],
        };
    }

    let latestTimestamp =
        -Infinity;

    for (const row of rows) {
        const timestamp =
            new Date(row.date).getTime();

        if (
            Number.isFinite(timestamp) &&
            timestamp > latestTimestamp
        ) {
            latestTimestamp =
                timestamp;
        }
    }

    if (
        latestTimestamp === -Infinity
    ) {
        return {
            analysisDate: null,
            customers: [],
            segments: [],
        };
    }

    const analysisDate =
        new Date(
            latestTimestamp,
        );

    const rawCustomers = [
        ...lifetime.entries(),
    ].map(
        ([
             customer,
             stats,
         ]) => {
            const lastPurchase =
                new Date(
                    stats.lastPurchase,
                );

            const recencyDays =
                Math.max(
                    0,
                    Math.floor(
                        (
                            analysisDate.getTime() -
                            lastPurchase.getTime()
                        ) / DAY_MS,
                    ),
                );

            return {
                customer,
                recencyDays,
                frequency:
                stats.orders.size,
                monetary:
                stats.revenue,
                firstPurchase:
                stats.firstPurchase,
                lastPurchase:
                stats.lastPurchase,
            };
        },
    );

    const recencies =
        rawCustomers
            .map(
                (customer) =>
                    customer.recencyDays,
            )
            .sort(
                (left, right) =>
                    left - right,
            );

    const frequencies =
        rawCustomers
            .map(
                (customer) =>
                    customer.frequency,
            )
            .sort(
                (left, right) =>
                    left - right,
            );

    const monetaryValues =
        rawCustomers
            .map(
                (customer) =>
                    customer.monetary,
            )
            .sort(
                (left, right) =>
                    left - right,
            );

    const customers: RfmCustomer[] =
        rawCustomers.map(
            (customer) => {
                const recencyScore =
                    quantileScore(
                        customer.recencyDays,
                        recencies,
                        false,
                    );

                const frequencyScore =
                    quantileScore(
                        customer.frequency,
                        frequencies,
                        true,
                    );

                const monetaryScore =
                    quantileScore(
                        customer.monetary,
                        monetaryValues,
                        true,
                    );

                return {
                    ...customer,
                    recencyScore,
                    frequencyScore,
                    monetaryScore,

                    totalScore:
                        recencyScore +
                        frequencyScore +
                        monetaryScore,

                    segment:
                        classifyRfmSegment(
                            recencyScore,
                            frequencyScore,
                            monetaryScore,
                        ),
                };
            },
        );

    const segmentMap =
        new Map<
            RfmSegment,
            {
                customers: number;
                revenue: number;
            }
        >();

    for (const customer of customers) {
        const summary =
            segmentMap.get(
                customer.segment,
            ) ?? {
                customers: 0,
                revenue: 0,
            };

        summary.customers += 1;
        summary.revenue +=
            customer.monetary;

        segmentMap.set(
            customer.segment,
            summary,
        );
    }

    const segments: RfmSegmentSummary[] =
        [...segmentMap.entries()]
            .map(
                ([
                     segment,
                     summary,
                 ]) => ({
                    segment,
                    customers:
                    summary.customers,
                    revenue:
                    summary.revenue,
                    averageRevenue:
                        summary.customers ===
                        0
                            ? 0
                            : summary.revenue /
                            summary.customers,
                }),
            )
            .sort(
                (left, right) =>
                    right.revenue -
                    left.revenue,
            );

    return {
        analysisDate:
            analysisDate.toISOString(),
        customers:
            customers.sort(
                (left, right) =>
                    right.totalScore -
                    left.totalScore,
            ),
        segments,
    };
}