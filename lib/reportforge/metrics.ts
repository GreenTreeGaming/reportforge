import type {
    CleanSalesRow,
    SalesMetrics,
} from "./types";

function sum(
    values: number[],
): number {
    return values.reduce(
        (total, value) =>
            total + value,
        0,
    );
}

function median(
    values: number[],
): number {
    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort(
        (left, right) =>
            left - right,
    );

    const midpoint = Math.floor(
        sorted.length / 2,
    );

    if (sorted.length % 2 === 1) {
        return sorted[midpoint];
    }

    return (
        sorted[midpoint - 1] +
        sorted[midpoint]
    ) / 2;
}

function revenueBy(
    rows: CleanSalesRow[],
    field: "customer" | "product",
): Map<string, number> {
    const totals =
        new Map<string, number>();

    for (const row of rows) {
        const key = row[field];

        if (!key) {
            continue;
        }

        totals.set(
            key,
            (totals.get(key) ?? 0) +
            row.revenue,
        );
    }

    return totals;
}

function largestShare(
    totals: Map<string, number>,
    denominator: number,
): number {
    if (
        totals.size === 0 ||
        denominator === 0
    ) {
        return 0;
    }

    const largest = Math.max(
        ...totals.values(),
    );

    return largest / denominator;
}

function detectRevenueAnomalies(
    rows: CleanSalesRow[],
): number {
    const values = rows
        .map((row) => row.revenue)
        .filter(
            (value) =>
                Number.isFinite(value),
        )
        .sort(
            (left, right) =>
                left - right,
        );

    if (values.length < 4) {
        return 0;
    }

    const lowerHalf = values.slice(
        0,
        Math.floor(values.length / 2),
    );

    const upperHalf = values.slice(
        Math.ceil(values.length / 2),
    );

    const q1 = median(lowerHalf);
    const q3 = median(upperHalf);
    const iqr = q3 - q1;

    const lowerBound =
        q1 - 1.5 * iqr;

    const upperBound =
        q3 + 1.5 * iqr;

    return values.filter(
        (value) =>
            value < lowerBound ||
            value > upperBound,
    ).length;
}

export function calculateMetrics(
    rows: CleanSalesRow[],
): SalesMetrics {
    const totalRevenue = sum(
        rows.map(
            (row) => row.revenue,
        ),
    );

    const rowsWithCost = rows.filter(
        (
            row,
        ): row is CleanSalesRow & {
            cost: number;
            profit: number;
        } =>
            row.cost !== null &&
            row.profit !== null,
    );

    const fullCostCoverage =
        rows.length > 0 &&
        rowsWithCost.length ===
        rows.length;

    const totalCost =
        fullCostCoverage
            ? sum(
                rowsWithCost.map(
                    (row) => row.cost,
                ),
            )
            : null;

    const grossProfit =
        fullCostCoverage
            ? sum(
                rowsWithCost.map(
                    (row) => row.profit,
                ),
            )
            : null;

    const grossMargin =
        grossProfit !== null &&
        totalRevenue !== 0
            ? grossProfit /
            totalRevenue
            : null;

    const orderTotals =
        new Map<string, number>();

    for (const row of rows) {
        if (!row.orderId) {
            continue;
        }

        orderTotals.set(
            row.orderId,
            (orderTotals.get(
                row.orderId,
            ) ?? 0) +
            row.revenue,
        );
    }

    const orderValues = [
        ...orderTotals.values(),
    ];

    const customerRows = rows.filter(
        (
            row,
        ): row is CleanSalesRow & {
            customer: string;
        } => row.customer !== null,
    );

    const customerTotals =
        revenueBy(
            customerRows,
            "customer",
        );

    const productTotals =
        revenueBy(
            rows,
            "product",
        );

    const customerOrderSets =
        new Map<
            string,
            Set<string>
        >();

    for (const row of customerRows) {
        const customer = row.customer;

        const orderKey =
            row.orderId ??
            `row:${row.sourceRow}`;

        const orders =
            customerOrderSets.get(
                customer,
            ) ??
            new Set<string>();

        orders.add(orderKey);

        customerOrderSets.set(
            customer,
            orders,
        );
    }

    const repeatCustomers = [
        ...customerOrderSets.values(),
    ].filter(
        (orders) =>
            orders.size > 1,
    ).length;

    const customerRevenue = sum(
        customerRows.map(
            (row) => row.revenue,
        ),
    );

    const rowsWithCustomer =
        customerRows.length;

    const rowsWithOrderId =
        rows.filter(
            (row) =>
                row.orderId !== null,
        ).length;

    return {
        totalRevenue,
        totalCost,
        grossProfit,
        grossMargin,

        lineItemCount:
        rows.length,

        orderCount:
            orderTotals.size > 0
                ? orderTotals.size
                : null,

        averageLineValue:
            rows.length === 0
                ? 0
                : totalRevenue /
                rows.length,

        averageOrderValue:
            orderValues.length > 0
                ? sum(orderValues) /
                orderValues.length
                : null,

        medianOrderValue:
            orderValues.length > 0
                ? median(
                    orderValues,
                )
                : null,

        uniqueCustomers:
        customerTotals.size,

        uniqueProducts:
        productTotals.size,

        customerCoverage:
            rows.length === 0
                ? 0
                : rowsWithCustomer /
                rows.length,

        orderIdCoverage:
            rows.length === 0
                ? 0
                : rowsWithOrderId /
                rows.length,

        repeatCustomerRate:
            customerTotals.size === 0
                ? 0
                : repeatCustomers /
                customerTotals.size,

        topCustomerShare:
            largestShare(
                customerTotals,
                customerRevenue,
            ),

        topProductShare:
            largestShare(
                productTotals,
                totalRevenue,
            ),

        anomalyCount:
            detectRevenueAnomalies(
                rows,
            ),
    };
}