"use client";

import Link from "next/link";
import {
    useParams,
    useRouter,
} from "next/navigation";
import {
    useEffect,
    useState,
} from "react";

import {
    getReportUpload,
} from "@/lib/reportforge/upload-storage";
import type {
    ColumnMapping,
    SalesMetrics,
} from "@/lib/reportforge/types";

type AnalysisResult = {
    metrics: SalesMetrics;
    cleaning: {
        sourceRows: number;
        acceptedRows: number;
        rejectedRows: number;
        salesRows: number;
        returnRows: number;
        costCoverage: number;
    };
    rejectedRows: Array<{
        sourceRow: number;
        reason: string;
        message: string;
    }>;
    preview: Array<{
        sourceRow: number;
        date: string;
        customer: string;
        product: string;
        revenue: number;
        cost: number | null;
        profit: number | null;
        transactionKind: string;
    }>;
    message?: string;
};

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

    const reportId = params.reportId;

    const [result, setResult] =
        useState<AnalysisResult | null>(null);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function analyze(): Promise<void> {
            try {
                const file =
                    await getReportUpload(reportId);

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

                const body = new FormData();

                body.append(
                    "file",
                    file,
                    file.name,
                );

                body.append(
                    "mapping",
                    JSON.stringify(mapping),
                );

                const response = await fetch(
                    "/api/analyze",
                    {
                        method: "POST",
                        body,
                    },
                );

                const data =
                    (await response.json()) as AnalysisResult;

                if (!response.ok) {
                    throw new Error(
                        data.message ??
                        "The report could not be analyzed.",
                    );
                }

                if (!cancelled) {
                    setResult(data);

                    sessionStorage.setItem(
                        `reportforge:${reportId}:analysis`,
                        JSON.stringify(data),
                    );
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
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

    const router = useRouter();

    if (error) {
        return (
            <main className="min-h-screen bg-[#f6f6f2] px-5 py-16 text-[#191918]">
                <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7">
                    <h1 className="text-2xl font-semibold">
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
            <main className="grid min-h-screen place-items-center bg-[#f6f6f2] text-[#191918]">
                <div className="text-center">
                    <div className="mx-auto size-7 animate-spin rounded-full border-2 border-black/15 border-t-[#191918]" />

                    <p className="mt-4 text-sm text-[#696965]">
                        Cleaning rows and calculating your report…
                    </p>
                </div>
            </main>
        );
    }

    const metrics = result.metrics;

    return (
        <div className="min-h-screen bg-[#f6f6f2] text-[#191918]">
            <header className="border-b border-black/8 bg-white">
                <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
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
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2457e6]">
                    Data review
                </p>

                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                    Your spreadsheet is ready.
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-[#696965]">
                    Review the accepted data and baseline results before
                    ReportForge builds the complete report.
                </p>

                <section className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        label="Revenue"
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
                        label="Customers"
                        value={metrics.uniqueCustomers.toLocaleString()}
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
                    <h2 className="text-lg font-semibold">
                        Data quality
                    </h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <QualityValue
                            label="Rows accepted"
                            value={result.cleaning.acceptedRows}
                        />

                        <QualityValue
                            label="Rows excluded"
                            value={result.cleaning.rejectedRows}
                        />

                        <QualityValue
                            label="Returns detected"
                            value={result.cleaning.returnRows}
                        />
                    </div>
                </section>

                <section className="mt-8 overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <div className="p-5 sm:p-6">
                        <h2 className="text-lg font-semibold">
                            Clean data preview
                        </h2>

                        <p className="mt-2 text-sm text-[#777772]">
                            Showing the first{" "}
                            {result.preview.length} accepted rows.
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
                                    Customer
                                </th>
                                <th className="px-4 py-3">
                                    Product
                                </th>
                                <th className="px-4 py-3">
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
                                        key={row.sourceRow}
                                        className="border-t border-black/6"
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 text-[#696965]">
                                            {new Date(
                                                row.date,
                                            ).toLocaleString()}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            {row.customer}
                                        </td>

                                        <td className="max-w-72 truncate px-4 py-3">
                                            {row.product}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3">
                                            {money(row.revenue)}
                                        </td>

                                        <td className="px-4 py-3 capitalize text-[#696965]">
                                            {row.transactionKind}
                                        </td>
                                    </tr>
                                ),
                            )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <button
                    type="button"
                    onClick={() =>
                        router.push(
                            `/reports/${encodeURIComponent(
                                reportId,
                            )}/overview`,
                        )
                    }
                    className="rounded-xl bg-[#191918] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                    Build complete report
                </button>
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
            <p className="text-2xl font-semibold">
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