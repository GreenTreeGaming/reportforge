"use client";

import Link from "next/link";
import {
    useParams,
    useRouter,
} from "next/navigation";
import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    getReportAnalysis,
    getReportUpload,
    saveReportAnalysis,
} from "@/lib/reportforge/upload-storage";

import type {
    AnalysisResult,
    ColumnMapping,
} from "@/lib/reportforge/types";

type AnalysisProgressEvent = {
    type: "progress";
    progress: number;
    stage: string;
    detail: string;
};

type AnalysisCompleteEvent = {
    type: "complete";
    result: AnalysisResult;
};

type AnalysisErrorEvent = {
    type: "error";
    message: string;
};

type AnalysisStreamEvent =
    | AnalysisProgressEvent
    | AnalysisCompleteEvent
    | AnalysisErrorEvent;

function money(
    value: number | null,
): string {
    if (value === null) {
        return "Not available";
    }

    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        },
    ).format(value);
}

function percent(
    value: number | null,
): string {
    if (value === null) {
        return "Not available";
    }

    return new Intl.NumberFormat(
        "en-US",
        {
            style: "percent",
            maximumFractionDigits: 1,
        },
    ).format(value);
}

export default function ReviewPage() {
    const params = useParams<{
        reportId: string;
    }>();

    const router = useRouter();
    const reportId = params.reportId;

    const analysisStarted =
        useRef(false);

    const [progress, setProgress] =
        useState(0);

    const [progressStage, setProgressStage] =
        useState(
            "Preparing analysis",
        );

    const [progressDetail, setProgressDetail] =
        useState(
            "Getting the uploaded spreadsheet ready.",
        );

    const [result, setResult] =
        useState<AnalysisResult | null>(null);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        if (analysisStarted.current) {
            return;
        }

        analysisStarted.current = true;

        let cancelled = false;

        async function analyze(): Promise<void> {
            try {
                setProgress(2);
                setProgressStage(
                    "Checking saved report",
                );
                setProgressDetail(
                    "Looking for a previously completed analysis.",
                );

                const existingResult =
                    await getReportAnalysis(
                        reportId,
                    );

                if (
                    existingResult?.advanced
                ) {
                    if (!cancelled) {
                        setProgress(100);
                        setProgressStage(
                            "Report ready",
                        );
                        setProgressDetail(
                            "The saved report was loaded successfully.",
                        );
                        setResult(
                            existingResult,
                        );
                    }

                    return;
                }

                setProgress(4);
                setProgressStage(
                    "Loading spreadsheet",
                );
                setProgressDetail(
                    "Reading the uploaded file from browser storage.",
                );

                const file =
                    await getReportUpload(
                        reportId,
                    );

                if (!file) {
                    throw new Error(
                        "The uploaded spreadsheet could not be found. Upload it again.",
                    );
                }

                const rawMapping =
                    sessionStorage.getItem(
                        `reportforge:${reportId}:mapping`,
                    );

                if (!rawMapping) {
                    throw new Error(
                        "The column mapping could not be found.",
                    );
                }

                const mapping =
                    JSON.parse(
                        rawMapping,
                    ) as ColumnMapping;

                const body =
                    new FormData();

                body.append(
                    "file",
                    file,
                    file.name,
                );

                body.append(
                    "mapping",
                    JSON.stringify(
                        mapping,
                    ),
                );

                setProgress(6);
                setProgressStage(
                    "Uploading for analysis",
                );
                setProgressDetail(
                    `${file.name} is being sent to the analysis engine.`,
                );

                const response =
                    await fetch(
                        "/api/analyze",
                        {
                            method: "POST",
                            body,
                        },
                    );

                if (!response.body) {
                    throw new Error(
                        "The analysis stream could not be opened.",
                    );
                }

                const reader =
                    response.body.getReader();

                const decoder =
                    new TextDecoder();

                let buffer = "";
                let completedResult:
                    AnalysisResult | null =
                    null;

                while (true) {
                    const {
                        value,
                        done,
                    } =
                        await reader.read();

                    if (done) {
                        break;
                    }

                    buffer +=
                        decoder.decode(
                            value,
                            {
                                stream: true,
                            },
                        );

                    const lines =
                        buffer.split("\n");

                    buffer =
                        lines.pop() ?? "";

                    for (const line of lines) {
                        const trimmed =
                            line.trim();

                        if (!trimmed) {
                            continue;
                        }

                        let event:
                            AnalysisStreamEvent;

                        try {
                            event =
                                JSON.parse(
                                    trimmed,
                                ) as AnalysisStreamEvent;
                        } catch {
                            continue;
                        }

                        if (
                            event.type ===
                            "progress"
                        ) {
                            if (!cancelled) {
                                setProgress(
                                    event.progress,
                                );

                                setProgressStage(
                                    event.stage,
                                );

                                setProgressDetail(
                                    event.detail,
                                );
                            }

                            continue;
                        }

                        if (
                            event.type ===
                            "error"
                        ) {
                            throw new Error(
                                event.message,
                            );
                        }

                        if (
                            event.type ===
                            "complete"
                        ) {
                            completedResult =
                                event.result;
                        }
                    }
                }

                /*
                 * Handle a final NDJSON line that
                 * may not end with a newline.
                 */
                const remaining =
                    buffer.trim();

                if (remaining) {
                    const event =
                        JSON.parse(
                            remaining,
                        ) as AnalysisStreamEvent;

                    if (
                        event.type ===
                        "error"
                    ) {
                        throw new Error(
                            event.message,
                        );
                    }

                    if (
                        event.type ===
                        "complete"
                    ) {
                        completedResult =
                            event.result;
                    }
                }

                if (!completedResult) {
                    throw new Error(
                        "The analysis ended before a completed report was returned.",
                    );
                }

                if (!cancelled) {
                    setProgress(99);
                    setProgressStage(
                        "Saving report",
                    );
                    setProgressDetail(
                        "Saving the completed report in your browser.",
                    );
                }

                await saveReportAnalysis(
                    reportId,
                    completedResult,
                );

                if (!cancelled) {
                    setProgress(100);
                    setProgressStage(
                        "Report ready",
                    );
                    setProgressDetail(
                        "The analysis finished successfully.",
                    );

                    setResult(
                        completedResult,
                    );
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof
                        Error
                            ? caughtError.message
                            : "An unexpected error occurred.",
                    );
                }
            }
        }

        void analyze();

        return () => {
            cancelled = true;
        };
    }, [reportId]);

    if (error) {
        return (
            <main className="min-h-screen bg-[#f6f6f2] px-5 py-16 text-[#191918]">
                <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7">
                    <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                        Analysis could not be completed
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-[#696965]">
                        {error}
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-flex rounded-xl bg-[#191918] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Upload another file
                    </Link>
                </div>
            </main>
        );
    }

    if (!result) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#f6f6f2] px-5 text-[#191918]">
                <section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-8">
                    <div className="flex items-start justify-between gap-5">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2457e6]">
                                Building report
                            </p>

                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                                {progressStage}
                            </h1>

                            <p className="mt-3 min-h-12 text-sm leading-6 text-[#696965]">
                                {progressDetail}
                            </p>
                        </div>

                        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f1f4ff] text-sm font-bold text-[#2457e6]">
                            {Math.round(
                                progress,
                            )}
                            %
                        </div>
                    </div>

                    <div className="mt-7">
                        <div className="h-3 overflow-hidden rounded-full bg-[#ecece7]">
                            <div
                                className="h-full rounded-full bg-[#2457e6] transition-[width] duration-500 ease-out"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            progress,
                                        ),
                                    )}%`,
                                }}
                            />
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-[#8a8a85]">
                        <span>
                            Actual server progress
                        </span>

                            <span>
                            {Math.round(
                                progress,
                            )}
                                % complete
                        </span>
                        </div>
                    </div>

                    <div className="mt-7 grid grid-cols-4 gap-2">
                        <ProgressStep
                            label="Prepare"
                            active={
                                progress >= 3
                            }
                            complete={
                                progress >= 25
                            }
                        />

                        <ProgressStep
                            label="Clean"
                            active={
                                progress >= 25
                            }
                            complete={
                                progress >= 50
                            }
                        />

                        <ProgressStep
                            label="Analyze"
                            active={
                                progress >= 50
                            }
                            complete={
                                progress >= 92
                            }
                        />

                        <ProgressStep
                            label="Finish"
                            active={
                                progress >= 92
                            }
                            complete={
                                progress >= 100
                            }
                        />
                    </div>

                    <p className="mt-7 text-xs leading-5 text-[#92928d]">
                        Large spreadsheets may spend most of
                        their time in row cleaning, product
                        comparison, and customer segmentation.
                        Keep this tab open while the report is
                        generated.
                    </p>
                </section>
            </main>
        );
    }

    const metrics = result.metrics;

    return (
        <div className="min-h-screen bg-[#f6f6f2] text-[#191918]">
            <header className="border-b border-black/8 bg-white">
                <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
                    <Link
                        href="/"
                        className="flex items-center gap-3"
                    >
                        <div className="grid size-9 place-items-center rounded-[11px] bg-[#191918] text-xs font-bold text-white">
                            RF
                        </div>

                        <span className="text-sm font-semibold">
                            ReportForge
                        </span>
                    </Link>

                    <span className="text-xs text-[#777772]">
                        Step 3 of 3
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
                <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2457e6]">
                        Data review
                    </p>

                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                        Your spreadsheet is ready.
                    </h1>

                    <p className="mt-4 max-w-2xl text-base leading-7 text-[#696965]">
                        Review the normalized data and baseline
                        results before opening the complete
                        business report.
                    </p>
                </div>

                <section className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard
                        label="Net revenue"
                        value={money(
                            metrics.totalRevenue,
                        )}
                    />

                    <MetricCard
                        label="Orders"
                        value={
                            metrics.orderCount?.toLocaleString() ??
                            "Not available"
                        }
                    />

                    <MetricCard
                        label="Known customers"
                        value={metrics.uniqueCustomers.toLocaleString()}
                    />

                    <MetricCard
                        label="Line items"
                        value={metrics.lineItemCount.toLocaleString()}
                    />

                    <MetricCard
                        label="Average line value"
                        value={money(
                            metrics.averageLineValue,
                        )}
                    />

                    <MetricCard
                        label="Average order"
                        value={money(
                            metrics.averageOrderValue,
                        )}
                    />
                </section>

                <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.025em]">
                                Data quality
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-[#777772]">
                                Coverage and transformations used
                                in this report.
                            </p>
                        </div>

                        <p className="text-xs text-[#92928d]">
                            {result.cleaning.sourceRows.toLocaleString()}{" "}
                            source rows
                        </p>
                    </div>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <QualityValue
                            label="Rows accepted"
                            value={
                                result.cleaning
                                    .acceptedRows
                            }
                        />

                        <QualityValue
                            label="Rows excluded"
                            value={
                                result.cleaning
                                    .rejectedRows
                            }
                        />

                        <QualityValue
                            label="Returns and cancellations"
                            value={
                                result.cleaning
                                    .returnRows
                            }
                        />

                        <QualityValue
                            label="Cost coverage"
                            value={percent(
                                result.cleaning
                                    .costCoverage,
                            )}
                        />

                        <QualityValue
                            label="Customer coverage"
                            value={percent(
                                metrics.customerCoverage,
                            )}
                        />

                        <QualityValue
                            label="Order ID coverage"
                            value={percent(
                                metrics.orderIdCoverage,
                            )}
                        />

                        <QualityValue
                            label="Unique products"
                            value={
                                metrics.uniqueProducts
                            }
                        />

                        <QualityValue
                            label="Revenue anomalies"
                            value={
                                metrics.anomalyCount
                            }
                        />
                    </div>
                </section>

                {result.rejectedRows.length > 0 ? (
                    <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
                        <h2 className="text-lg font-semibold tracking-[-0.025em]">
                            Excluded-row sample
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#777772]">
                            Showing up to{" "}
                            {result.rejectedRows.length} rows
                            that could not be used.
                        </p>

                        <div className="mt-5 overflow-x-auto rounded-xl border border-black/10">
                            <table className="min-w-full text-left text-xs">
                                <thead className="bg-[#f6f6f2]">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">
                                        Source row
                                    </th>

                                    <th className="px-4 py-3 font-semibold">
                                        Reason
                                    </th>

                                    <th className="px-4 py-3 font-semibold">
                                        Explanation
                                    </th>
                                </tr>
                                </thead>

                                <tbody>
                                {result.rejectedRows
                                    .slice(0, 10)
                                    .map((row) => (
                                        <tr
                                            key={`${row.sourceRow}-${row.reason}`}
                                            className="border-t border-black/6"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3">
                                                {row.sourceRow.toLocaleString()}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3 text-[#696965]">
                                                {row.reason.replaceAll(
                                                    "_",
                                                    " ",
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-[#696965]">
                                                {row.message}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : null}

                <section className="mt-8 overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <div className="p-5 sm:p-6">
                        <h2 className="text-lg font-semibold tracking-[-0.025em]">
                            Clean data preview
                        </h2>

                        <p className="mt-2 text-sm text-[#777772]">
                            Showing the first{" "}
                            {result.preview.length} accepted
                            line items.
                        </p>
                    </div>

                    <div className="overflow-x-auto border-t border-black/8">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-[#f6f6f2]">
                            <tr>
                                <th className="px-4 py-3">
                                    Date
                                </th>

                                <th className="px-4 py-3">
                                    Order
                                </th>

                                <th className="px-4 py-3">
                                    Customer
                                </th>

                                <th className="px-4 py-3">
                                    Product
                                </th>

                                <th className="px-4 py-3 text-right">
                                    Revenue
                                </th>

                                <th className="px-4 py-3">
                                    Type
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {result.preview.map(
                                (row) => (
                                    <tr
                                        key={
                                            row.sourceRow
                                        }
                                        className="border-t border-black/6"
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 text-[#696965]">
                                            {new Date(
                                                row.date,
                                            ).toLocaleString()}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            {row.orderId ??
                                                "Not available"}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            {row.customer ??
                                                "Unknown customer"}
                                        </td>

                                        <td className="max-w-72 truncate px-4 py-3">
                                            {row.product}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            {money(
                                                row.revenue,
                                            )}
                                        </td>

                                        <td className="px-4 py-3 capitalize text-[#696965]">
                                            {
                                                row.transactionKind
                                            }
                                        </td>
                                    </tr>
                                ),
                            )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                        href={`/reports/${encodeURIComponent(
                            reportId,
                        )}/mapping`}
                        className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold transition hover:bg-[#fafaf8]"
                    >
                        Change field mapping
                    </Link>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                `/reports/${encodeURIComponent(
                                    reportId,
                                )}/overview`,
                            )
                        }
                        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#191918] px-5 text-sm font-semibold text-white transition hover:bg-black"
                    >
                        Open complete report
                    </button>
                </div>
            </main>
        </div>
    );
}

function MetricCard({
                        label,
                        value,
                    }: {
    label: string;
    value: string;
}) {
    return (
        <article className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs font-medium text-[#777772]">
                {label}
            </p>

            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                {value}
            </p>
        </article>
    );
}

function QualityValue({
                          label,
                          value,
                      }: {
    label: string;
    value: string | number;
}) {
    return (
        <div>
            <p className="text-2xl font-semibold tracking-[-0.035em]">
                {typeof value === "number"
                    ? value.toLocaleString()
                    : value}
            </p>

            <p className="mt-1 text-sm text-[#777772]">
                {label}
            </p>
        </div>
    );
}

function ProgressStep({
                          label,
                          active,
                          complete,
                      }: {
    label: string;
    active: boolean;
    complete: boolean;
}) {
    return (
        <div>
            <div
                className={[
                    "h-1.5 rounded-full transition",
                    complete
                        ? "bg-[#2457e6]"
                        : active
                            ? "animate-pulse bg-[#89a5f5]"
                            : "bg-[#e6e6e1]",
                ].join(" ")}
            />

            <p
                className={[
                    "mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em]",
                    active
                        ? "text-[#2457e6]"
                        : "text-[#a0a09b]",
                ].join(" ")}
            >
                {label}
            </p>
        </div>
    );
}