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
    ColumnMapping,
    NumericFieldMapping,
} from "@/lib/reportforge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProgressEvent = {
    type: "progress";
    progress: number;
    stage: string;
    detail: string;
};

type CompleteEvent = {
    type: "complete";
    result: AnalysisResult;
};

type ErrorEvent = {
    type: "error";
    message: string;
};

type StreamEvent =
    | ProgressEvent
    | CompleteEvent
    | ErrorEvent;

function isNumericMappingValid(
    mapping:
        | NumericFieldMapping
        | null
        | undefined,
    required: boolean,
): boolean {
    if (!mapping) {
        return !required;
    }

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
        !parsed.product
    ) {
        throw new Error(
            "Date and product mappings are required.",
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

function nextFrame(): Promise<void> {
    return new Promise(
        (resolve) => {
            setTimeout(
                resolve,
                0,
            );
        },
    );
}

export async function POST(
    request: Request,
): Promise<Response> {
    const encoder =
        new TextEncoder();

    const stream =
        new ReadableStream<Uint8Array>({
            async start(controller) {
                let closed = false;

                function send(
                    event: StreamEvent,
                ): void {
                    if (closed) {
                        return;
                    }

                    controller.enqueue(
                        encoder.encode(
                            `${JSON.stringify(
                                event,
                            )}\n`,
                        ),
                    );
                }

                async function progress(
                    percentage: number,
                    stage: string,
                    detail: string,
                ): Promise<void> {
                    send({
                        type: "progress",
                        progress:
                        percentage,
                        stage,
                        detail,
                    });

                    /*
                     * Give Node a chance to flush
                     * the progress event before the
                     * next CPU-heavy stage starts.
                     */
                    await nextFrame();
                }

                try {
                    await progress(
                        3,
                        "Receiving upload",
                        "Reading the uploaded spreadsheet and field mapping.",
                    );

                    const formData =
                        await request.formData();

                    const file =
                        formData.get(
                            "file",
                        );

                    if (
                        !(
                            file instanceof
                            File
                        )
                    ) {
                        throw new Error(
                            "A spreadsheet file is required.",
                        );
                    }

                    const mapping =
                        parseMapping(
                            formData.get(
                                "mapping",
                            ),
                        );

                    await progress(
                        10,
                        "Opening spreadsheet",
                        `Opening ${file.name}.`,
                    );

                    const parsed =
                        await parseSpreadsheet(
                            file,
                        );

                    await progress(
                        25,
                        "Spreadsheet parsed",
                        `${parsed.rows.length.toLocaleString()} source rows and ${parsed.columns.length.toLocaleString()} columns were found.`,
                    );

                    await progress(
                        30,
                        "Cleaning rows",
                        "Validating dates, products, revenue, customers, orders, and returns.",
                    );

                    const cleaning =
                        cleanSalesRows(
                            parsed.rows,
                            mapping,
                        );

                    if (
                        cleaning.rows
                            .length === 0
                    ) {
                        throw new Error(
                            "No usable sales rows remained after cleaning.",
                        );
                    }

                    await progress(
                        46,
                        "Rows cleaned",
                        `${cleaning.summary.acceptedRows.toLocaleString()} rows accepted and ${cleaning.summary.rejectedRows.toLocaleString()} excluded.`,
                    );

                    await progress(
                        50,
                        "Calculating core metrics",
                        "Calculating revenue, orders, averages, customer coverage, concentration, and anomalies.",
                    );

                    const metrics =
                        calculateMetrics(
                            cleaning.rows,
                        );

                    await progress(
                        59,
                        "Building summaries",
                        "Grouping performance by month, product, customer, and region.",
                    );

                    const summaries =
                        buildReportSummaries(
                            cleaning.rows,
                        );

                    await progress(
                        68,
                        "Analyzing product momentum",
                        "Comparing recent product performance with the preceding matching period.",
                    );

                    const productMomentum =
                        calculateProductMomentum(
                            cleaning.rows,
                        );

                    await progress(
                        77,
                        "Analyzing customer movement",
                        "Classifying new, retained, expanded, contracted, returning, and lost customers.",
                    );

                    const customerMovement =
                        calculateCustomerMovement(
                            cleaning.rows,
                        );

                    await progress(
                        85,
                        "Segmenting customers",
                        "Calculating recency, frequency, monetary scores, and customer segments.",
                    );

                    const rfm =
                        calculateRfm(
                            cleaning.rows,
                        );

                    await progress(
                        92,
                        "Building decision queue",
                        "Turning the strongest findings into prioritized business actions.",
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

                    await progress(
                        96,
                        "Preparing report",
                        "Reducing large result sets and preparing the completed report.",
                    );

                    const compactProductMomentum =
                        {
                            ...productMomentum,

                            products: [
                                ...productMomentum.products,
                            ]
                                .sort(
                                    (
                                        left,
                                        right,
                                    ) =>
                                        Math.abs(
                                            right.revenueChange,
                                        ) -
                                        Math.abs(
                                            left.revenueChange,
                                        ),
                                )
                                .slice(
                                    0,
                                    500,
                                ),

                            fastestGrowing:
                                productMomentum.fastestGrowing.slice(
                                    0,
                                    25,
                                ),

                            fastestDeclining:
                                productMomentum.fastestDeclining.slice(
                                    0,
                                    25,
                                ),

                            newlyActive:
                                productMomentum.newlyActive.slice(
                                    0,
                                    25,
                                ),

                            becameInactive:
                                productMomentum.becameInactive.slice(
                                    0,
                                    25,
                                ),
                        };

                    const compactCustomerMovement =
                        {
                            ...customerMovement,

                            customers: [
                                ...customerMovement.customers,
                            ]
                                .sort(
                                    (
                                        left,
                                        right,
                                    ) =>
                                        Math.abs(
                                            right.revenueChange,
                                        ) -
                                        Math.abs(
                                            left.revenueChange,
                                        ),
                                )
                                .slice(
                                    0,
                                    500,
                                ),

                            newCustomers:
                                customerMovement.newCustomers.slice(
                                    0,
                                    25,
                                ),

                            expandedCustomers:
                                customerMovement.expandedCustomers.slice(
                                    0,
                                    25,
                                ),

                            contractedCustomers:
                                customerMovement.contractedCustomers.slice(
                                    0,
                                    25,
                                ),

                            returningCustomers:
                                customerMovement.returningCustomers.slice(
                                    0,
                                    25,
                                ),

                            lostCustomers:
                                customerMovement.lostCustomers.slice(
                                    0,
                                    25,
                                ),
                        };

                    const compactRfm = {
                        ...rfm,

                        customers: [
                            ...rfm.customers,
                        ]
                            .sort(
                                (
                                    left,
                                    right,
                                ) =>
                                    right.monetary -
                                    left.monetary,
                            )
                            .slice(
                                0,
                                500,
                            ),
                    };

                    const result:
                        AnalysisResult = {
                        metrics,

                        cleaning:
                        cleaning.summary,

                        summaries,

                        advanced: {
                            productMomentum:
                            compactProductMomentum,

                            customerMovement:
                            compactCustomerMovement,

                            rfm:
                            compactRfm,

                            decisions:
                                decisions.slice(
                                    0,
                                    20,
                                ),
                        },

                        rejectedRows:
                            cleaning.rejectedRows
                                .slice(
                                    0,
                                    100,
                                )
                                .map(
                                    (
                                        row,
                                    ) => ({
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

                    await progress(
                        99,
                        "Saving report",
                        "Sending the completed analysis to your browser.",
                    );

                    send({
                        type: "complete",
                        result,
                    });

                    closed = true;
                    controller.close();
                } catch (error) {
                    console.error(
                        "Report analysis failed:",
                        error,
                    );

                    send({
                        type: "error",
                        message:
                            error instanceof
                            Error
                                ? error.message
                                : "The report could not be analyzed.",
                    });

                    closed = true;
                    controller.close();
                }
            },
        });

    return new Response(
        stream,
        {
            headers: {
                "Content-Type":
                    "application/x-ndjson; charset=utf-8",

                "Cache-Control":
                    "no-cache, no-store, must-revalidate",

                Connection:
                    "keep-alive",

                "X-Content-Type-Options":
                    "nosniff",
            },
        },
    );
}