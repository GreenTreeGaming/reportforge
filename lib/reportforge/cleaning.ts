import type {
    CleanSalesRow,
    CleaningResult,
    ColumnMapping,
    NumericFieldMapping,
    RawRow,
    RejectedSalesRow,
} from "./types";

export function parseNumber(
    value: unknown,
): number | null {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return value;
    }

    const raw = String(value).trim();

    if (!raw) {
        return null;
    }

    const isParenthesized =
        raw.startsWith("(") &&
        raw.endsWith(")");

    const cleaned = raw
        .replace(/[$£€¥,\s]/g, "")
        .replace(/%$/, "");

    if (!cleaned) {
        return null;
    }

    const parsed = Number(
        isParenthesized
            ? `-${cleaned.slice(1, -1)}`
            : cleaned,
    );

    return Number.isFinite(parsed)
        ? parsed
        : null;
}

export function resolveNumericField(
    row: RawRow,
    mapping: NumericFieldMapping,
): number | null {
    if (mapping.mode === "none") {
        return null;
    }

    if (mapping.mode === "column") {
        return parseNumber(
            row[mapping.column],
        );
    }

    const left = parseNumber(
        row[mapping.leftColumn],
    );

    const right = parseNumber(
        row[mapping.rightColumn],
    );

    if (
        left === null ||
        right === null
    ) {
        return null;
    }

    return left * right;
}

function normalizeText(
    value: unknown,
): string {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseSpreadsheetDate(
    value: unknown,
): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : value;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        /*
         * Excel serial dates use 1899-12-30 as
         * their practical epoch.
         */
        const milliseconds =
            Math.round(
                (value - 25569) *
                86_400_000,
            );

        const date = new Date(milliseconds);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    const text = normalizeText(value);

    if (!text) {
        return null;
    }

    const nativeDate = new Date(text);

    if (!Number.isNaN(nativeDate.getTime())) {
        return nativeDate;
    }

    /*
     * Handles common US spreadsheet values:
     * 12/1/10 8:26
     * 12/1/2010
     */
    const match = text.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );

    if (!match) {
        return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);

    let year = Number(match[3]);

    if (year < 100) {
        year += year >= 70
            ? 1900
            : 2000;
    }

    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const second = Number(match[6] ?? 0);

    const date = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
    );

    const matchesInput =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

    return matchesInput
        ? date
        : null;
}

function toIsoDate(
    value: Date,
): string {
    return value.toISOString();
}

function rejected(
    sourceRow: number,
    reason: RejectedSalesRow["reason"],
    message: string,
    original: RawRow,
): RejectedSalesRow {
    return {
        sourceRow,
        reason,
        message,
        original,
    };
}

export function cleanSalesRows(
    rawRows: RawRow[],
    mapping: ColumnMapping,
): CleaningResult {
    const rows: CleanSalesRow[] = [];
    const rejectedRows: RejectedSalesRow[] = [];

    let salesRows = 0;
    let returnRows = 0;
    let rowsWithCost = 0;

    rawRows.forEach(
        (
            rawRow,
            index,
        ) => {
            /*
             * Row 1 is the header in the original
             * spreadsheet, so the first data row is 2.
             */
            const sourceRow = index + 2;

            const rawDate =
                rawRow[mapping.date];

            if (
                rawDate === null ||
                rawDate === undefined ||
                normalizeText(rawDate) === ""
            ) {
                rejectedRows.push(
                    rejected(
                        sourceRow,
                        "missing_date",
                        "Date is missing.",
                        rawRow,
                    ),
                );

                return;
            }

            const date =
                parseSpreadsheetDate(rawDate);

            if (!date) {
                rejectedRows.push(
                    rejected(
                        sourceRow,
                        "invalid_date",
                        "Date could not be interpreted.",
                        rawRow,
                    ),
                );

                return;
            }

            const customer = mapping.customer
                ? normalizeText(
                rawRow[mapping.customer],
            ) || null
                : null;

            const orderId = mapping.orderId
                ? normalizeText(
                rawRow[mapping.orderId],
            ) || null
                : null;

            const region = mapping.region
                ? normalizeText(
                rawRow[mapping.region],
            ) || null
                : null;

            const product = normalizeText(
                rawRow[mapping.product],
            );

            if (!product) {
                rejectedRows.push(
                    rejected(
                        sourceRow,
                        "missing_product",
                        "Product or service is missing.",
                        rawRow,
                    ),
                );

                return;
            }

            const revenue =
                resolveNumericField(
                    rawRow,
                    mapping.revenue,
                );

            if (revenue === null) {
                rejectedRows.push(
                    rejected(
                        sourceRow,
                        "missing_revenue",
                        "Revenue could not be calculated.",
                        rawRow,
                    ),
                );

                return;
            }

            if (!Number.isFinite(revenue)) {
                rejectedRows.push(
                    rejected(
                        sourceRow,
                        "invalid_revenue",
                        "Revenue is not a valid number.",
                        rawRow,
                    ),
                );

                return;
            }

            const cost =
                resolveNumericField(
                    rawRow,
                    mapping.cost,
                );

            if (cost !== null) {
                rowsWithCost += 1;
            }

            const transactionKind =
                orderId?.toUpperCase().startsWith("C")
                    ? "cancellation"
                    : revenue < 0
                        ? "return"
                        : "sale";

            if (transactionKind === "return") {
                returnRows += 1;
            } else {
                salesRows += 1;
            }

            rows.push({
                sourceRow,
                date: toIsoDate(date),
                customer,
                product,
                orderId,
                region,
                revenue,
                cost,
                profit:
                    cost === null
                        ? null
                        : revenue - cost,
                transactionKind,
                customerAnalysisEligible:
                    customer !== null,
                orderAnalysisEligible:
                    orderId !== null,
            });
        },
    );

    return {
        rows,
        rejectedRows,
        summary: {
            sourceRows: rawRows.length,
            acceptedRows: rows.length,
            rejectedRows:
            rejectedRows.length,
            salesRows,
            returnRows,
            costCoverage:
                rows.length === 0
                    ? 0
                    : rowsWithCost /
                    rows.length,
        },
    };
}