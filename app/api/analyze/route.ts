import {
    NextResponse,
} from "next/server";

import {
    cleanSalesRows,
} from "@/lib/reportforge/cleaning";

import {
    calculateCustomerMovement,
    calculateRfm,
} from "@/lib/reportforge/customers";

import {
    buildDecisionQueue,
} from "@/lib/reportforge/insights";

import {
    calculateMetrics,
} from "@/lib/reportforge/metrics";

import {
    parseSpreadsheet,
} from "@/lib/reportforge/parsing";

import {
    calculateProductMomentum,
} from "@/lib/reportforge/products";

import {
    buildReportSummaries,
} from "@/lib/reportforge/summaries";

import type {
    AnalysisResult,
    ApiErrorResponse,
    ColumnMapping,
    NumericFieldMapping,
} from "@/lib/reportforge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isNumericMappingValid(
    mapping: NumericFieldMapping,
    required: boolean,
): boolean {
    if (mapping.mode === "column") {
        return Boolean(
            mapping.column,
        );
    }

    if (
        mapping.mode === "multiply"
    ) {
        return Boolean(
            mapping.leftColumn &&
            mapping.rightColumn &&
            mapping.leftColumn !==
            mapping.rightColumn,
        );
    }

    return !required;
}

function parseMapping(
    raw: FormDataEntryValue | null,
): ColumnMapping {
    if (typeof raw !== "string") {
        throw new Error(
            "Column mapping is required.",
        );
    }

    let parsed: ColumnMapping;

    try {
        parsed = JSON.parse(
            raw,
        ) as ColumnMapping;
    } catch {
        throw new Error(
            "The column mapping is not valid JSON.",
        );
    }

    if (
        !parsed.date ||
        !parsed.product ||
        !parsed.revenue
    ) {
        throw new Error(
            "Date, product, and revenue mappings are required.",
        );
    }

    if (
        !isNumericMappingValid(
            parsed.revenue,
            true,
        )
    ) {
        throw new Error(
            "The revenue mapping is incomplete.",
        );
    }

    if (
        !isNumericMappingValid(
            parsed.cost,
            false,
        )
    ) {
        throw new Error(
            "The cost mapping is incomplete.",
        );
    }

    return {
        date: parsed.date,
        product: parsed.product,

        customer:
            parsed.customer || null,

        orderId:
            parsed.orderId || null,

        region:
            parsed.region || null,

        revenue:
        parsed.revenue,

        cost:
            parsed.cost ?? {
                mode: "none",
            },
    };
}

export async function POST(
    request: Request,
): Promise<
    NextResponse<
        AnalysisResult |
        ApiErrorResponse
    >
> {
    try {
        const formData =
            await request.formData();

        const file =
            formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    message:
                        "A spreadsheet file is required.",
                },
                {
                    status: 400,
                },
            );
        }

        const mapping =
            parseMapping(
                formData.get(
                    "mapping",
                ),
            );

        const parsed =
            await parseSpreadsheet(
                file,
            );

        const cleaning =
            cleanSalesRows(
                parsed.rows,
                mapping,
            );

        if (
            cleaning.rows.length === 0
        ) {
            return NextResponse.json(
                {
                    message:
                        "No usable sales rows remained after cleaning.",
                },
                {
                    status: 422,
                },
            );
        }

        const metrics =
            calculateMetrics(
                cleaning.rows,
            );

        const summaries =
            buildReportSummaries(
                cleaning.rows,
            );

        const productMomentum =
            calculateProductMomentum(
                cleaning.rows,
            );

        const customerMovement =
            calculateCustomerMovement(
                cleaning.rows,
            );

        const rfm =
            calculateRfm(
                cleaning.rows,
            );

        const decisions =
            buildDecisionQueue({
                metrics,
                cleaning:
                cleaning.summary,
                productMomentum,
                customerMovement,
                rfm,
            });

        const response:
            AnalysisResult = {
            metrics,
            cleaning:
            cleaning.summary,
            summaries,

            advanced: {
                productMomentum,
                customerMovement,
                rfm,
                decisions,
            },

            rejectedRows:
                cleaning.rejectedRows
                    .slice(0, 100)
                    .map(
                        (row) => ({
                            sourceRow:
                            row.sourceRow,
                            reason:
                            row.reason,
                            message:
                            row.message,
                        }),
                    ),

            preview:
                cleaning.rows.slice(
                    0,
                    100,
                ),
        };

        return NextResponse.json(
            response,
        );
    } catch (error) {
        console.error(
            "Report analysis failed:",
            error,
        );

        return NextResponse.json(
            {
                message:
                    error instanceof Error
                        ? error.message
                        : "The report could not be analyzed.",
            },
            {
                status: 422,
            },
        );
    }
}