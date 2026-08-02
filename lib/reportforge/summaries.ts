import type {
    CleanSalesRow,
    CustomerSummary,
    PeriodSummary,
    ProductSummary,
    RegionSummary,
    ReportSummaries,
} from "./types";

export type PeriodSummary = {
    period: string;
    revenue: number;
    salesRevenue: number;
    returnedRevenue: number;
    lineItems: number;
    orders: number;
    customers: number;
};

export type ProductSummary = {
    product: string;
    revenue: number;
    salesRevenue: number;
    returnedRevenue: number;
    lineItems: number;
    orders: number;
    customers: number;
    returnRate: number;
};

export type CustomerSummary = {
    customer: string;
    revenue: number;
    orders: number;
    lineItems: number;
    products: number;
    firstPurchase: string;
    lastPurchase: string;
    averageOrderValue: number;
};

export type RegionSummary = {
    region: string;
    revenue: number;
    orders: number;
    customers: number;
    lineItems: number;
};

export type ReportSummaries = {
    monthly: PeriodSummary[];
    products: ProductSummary[];
    customers: CustomerSummary[];
    regions: RegionSummary[];
};

function addToMap(
    map: Map<string, number>,
    key: string,
    value: number,
): void {
    map.set(
        key,
        (map.get(key) ?? 0) + value,
    );
}

function monthKey(
    isoDate: string,
): string {
    return isoDate.slice(0, 7);
}

export function buildMonthlySummary(
    rows: CleanSalesRow[],
): PeriodSummary[] {
    const groups = new Map<
        string,
        {
            revenue: number;
            salesRevenue: number;
            returnedRevenue: number;
            lineItems: number;
            orders: Set<string>;
            customers: Set<string>;
        }
    >();

    for (const row of rows) {
        const period = monthKey(row.date);

        const group =
            groups.get(period) ?? {
                revenue: 0,
                salesRevenue: 0,
                returnedRevenue: 0,
                lineItems: 0,
                orders: new Set<string>(),
                customers: new Set<string>(),
            };

        group.revenue += row.revenue;
        group.lineItems += 1;

        if (row.revenue >= 0) {
            group.salesRevenue += row.revenue;
        } else {
            group.returnedRevenue += Math.abs(
                row.revenue,
            );
        }

        if (row.orderId) {
            group.orders.add(row.orderId);
        }

        if (row.customer) {
            group.customers.add(row.customer);
        }

        groups.set(period, group);
    }

    return [...groups.entries()]
        .map(([period, group]) => ({
            period,
            revenue: group.revenue,
            salesRevenue: group.salesRevenue,
            returnedRevenue:
            group.returnedRevenue,
            lineItems: group.lineItems,
            orders: group.orders.size,
            customers: group.customers.size,
        }))
        .sort((left, right) =>
            left.period.localeCompare(
                right.period,
            ),
        );
}

export function buildProductSummary(
    rows: CleanSalesRow[],
): ProductSummary[] {
    const groups = new Map<
        string,
        {
            revenue: number;
            salesRevenue: number;
            returnedRevenue: number;
            lineItems: number;
            orders: Set<string>;
            customers: Set<string>;
        }
    >();

    for (const row of rows) {
        const group =
            groups.get(row.product) ?? {
                revenue: 0,
                salesRevenue: 0,
                returnedRevenue: 0,
                lineItems: 0,
                orders: new Set<string>(),
                customers: new Set<string>(),
            };

        group.revenue += row.revenue;
        group.lineItems += 1;

        if (row.revenue >= 0) {
            group.salesRevenue += row.revenue;
        } else {
            group.returnedRevenue += Math.abs(
                row.revenue,
            );
        }

        if (row.orderId) {
            group.orders.add(row.orderId);
        }

        if (row.customer) {
            group.customers.add(row.customer);
        }

        groups.set(row.product, group);
    }

    return [...groups.entries()]
        .map(([product, group]) => ({
            product,
            revenue: group.revenue,
            salesRevenue: group.salesRevenue,
            returnedRevenue:
            group.returnedRevenue,
            lineItems: group.lineItems,
            orders: group.orders.size,
            customers: group.customers.size,
            returnRate:
                group.salesRevenue === 0
                    ? 0
                    : group.returnedRevenue /
                    group.salesRevenue,
        }))
        .sort(
            (left, right) =>
                right.revenue -
                left.revenue,
        );
}

export function buildCustomerSummary(
    rows: CleanSalesRow[],
): CustomerSummary[] {
    const groups = new Map<
        string,
        {
            revenue: number;
            lineItems: number;
            orders: Map<string, number>;
            products: Set<string>;
            firstPurchase: string;
            lastPurchase: string;
        }
    >();

    for (const row of rows) {
        if (!row.customer) {
            continue;
        }

        const group =
            groups.get(row.customer) ?? {
                revenue: 0,
                lineItems: 0,
                orders: new Map<string, number>(),
                products: new Set<string>(),
                firstPurchase: row.date,
                lastPurchase: row.date,
            };

        group.revenue += row.revenue;
        group.lineItems += 1;
        group.products.add(row.product);

        if (row.date < group.firstPurchase) {
            group.firstPurchase = row.date;
        }

        if (row.date > group.lastPurchase) {
            group.lastPurchase = row.date;
        }

        const orderKey =
            row.orderId ??
            `row:${row.sourceRow}`;

        addToMap(
            group.orders,
            orderKey,
            row.revenue,
        );

        groups.set(row.customer, group);
    }

    return [...groups.entries()]
        .map(([customer, group]) => ({
            customer,
            revenue: group.revenue,
            orders: group.orders.size,
            lineItems: group.lineItems,
            products: group.products.size,
            firstPurchase:
            group.firstPurchase,
            lastPurchase:
            group.lastPurchase,
            averageOrderValue:
                group.orders.size === 0
                    ? 0
                    : group.revenue /
                    group.orders.size,
        }))
        .sort(
            (left, right) =>
                right.revenue -
                left.revenue,
        );
}

export function buildRegionSummary(
    rows: CleanSalesRow[],
): RegionSummary[] {
    const groups = new Map<
        string,
        {
            revenue: number;
            lineItems: number;
            orders: Set<string>;
            customers: Set<string>;
        }
    >();

    for (const row of rows) {
        if (!row.region) {
            continue;
        }

        const group =
            groups.get(row.region) ?? {
                revenue: 0,
                lineItems: 0,
                orders: new Set<string>(),
                customers: new Set<string>(),
            };

        group.revenue += row.revenue;
        group.lineItems += 1;

        if (row.orderId) {
            group.orders.add(row.orderId);
        }

        if (row.customer) {
            group.customers.add(row.customer);
        }

        groups.set(row.region, group);
    }

    return [...groups.entries()]
        .map(([region, group]) => ({
            region,
            revenue: group.revenue,
            orders: group.orders.size,
            customers: group.customers.size,
            lineItems: group.lineItems,
        }))
        .sort(
            (left, right) =>
                right.revenue -
                left.revenue,
        );
}

export function buildReportSummaries(
    rows: CleanSalesRow[],
): ReportSummaries {
    return {
        monthly:
            buildMonthlySummary(rows),
        products:
            buildProductSummary(rows),
        customers:
            buildCustomerSummary(rows),
        regions:
            buildRegionSummary(rows),
    };
}