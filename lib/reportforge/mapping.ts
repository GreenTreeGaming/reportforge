import type {
    ColumnMapping,
    NumericFieldMapping,
} from "./types";

function normalizeColumnName(
    value: string,
): string {
    return value
        .toLowerCase()
        .replace(/[_\-/]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findColumn(
    columns: string[],
    keywords: string[],
): string | null {
    return (
        columns.find((column) => {
            const normalized =
                normalizeColumnName(column);

            return keywords.some((keyword) =>
                normalized.includes(keyword),
            );
        }) ?? null
    );
}

function guessRevenue(
    columns: string[],
): NumericFieldMapping {
    const directRevenue = findColumn(
        columns,
        [
            "revenue",
            "total revenue",
            "sales",
            "total sales",
            "amount",
            "total amount",
            "line total",
            "extended price",
            "net sales",
        ],
    );

    if (directRevenue) {
        return {
            mode: "column",
            column: directRevenue,
        };
    }

    const quantity = findColumn(
        columns,
        [
            "quantity",
            "qty",
            "units sold",
            "units",
        ],
    );

    const unitPrice = findColumn(
        columns,
        [
            "unit price",
            "unitprice",
            "price each",
            "priceeach",
            "selling price",
            "sale price",
        ],
    );

    if (quantity && unitPrice) {
        return {
            mode: "multiply",
            leftColumn: quantity,
            rightColumn: unitPrice,
        };
    }

    return {
        mode: "none",
    };
}

function guessCost(
    columns: string[],
): NumericFieldMapping {
    const directCost = findColumn(
        columns,
        [
            "total cost",
            "cost total",
            "cogs",
            "cost of goods",
            "expense",
        ],
    );

    if (directCost) {
        return {
            mode: "column",
            column: directCost,
        };
    }

    const quantity = findColumn(
        columns,
        [
            "quantity",
            "qty",
            "units sold",
            "units",
        ],
    );

    const unitCost = findColumn(
        columns,
        [
            "unit cost",
            "unitcost",
            "cost each",
            "cost per unit",
        ],
    );

    if (quantity && unitCost) {
        return {
            mode: "multiply",
            leftColumn: quantity,
            rightColumn: unitCost,
        };
    }

    return {
        mode: "none",
    };
}

export function guessMapping(
    columns: string[],
): ColumnMapping {
    return {
        date:
            findColumn(
                columns,
                [
                    "invoice date",
                    "order date",
                    "transaction date",
                    "sale date",
                    "date",
                ],
            ) ?? "",

        customer:
            findColumn(
                columns,
                [
                    "customer id",
                    "customer name",
                    "customer",
                    "client",
                    "account",
                    "buyer",
                ],
            ) ?? "",

        product:
            findColumn(
                columns,
                [
                    "description",
                    "product name",
                    "product",
                    "service",
                    "item",
                    "sku",
                    "stock code",
                ],
            ) ?? "",

        revenue: guessRevenue(columns),
        cost: guessCost(columns),
    };
}