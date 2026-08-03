"use client";

import Link from "next/link";
import {
    useParams,
    useRouter,
} from "next/navigation";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    AnalysisResult,
} from "@/lib/reportforge/types";
import {
    getReportAnalysis,
} from "@/lib/reportforge/upload-storage";

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
            maximumFractionDigits: 0,
        },
    ).format(value);
}

function percent(
    value: number,
): string {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "percent",
            maximumFractionDigits: 1,
        },
    ).format(value);
}

function monthLabel(
    period: string,
): string {
    const [year, month] =
        period.split("-").map(Number);

    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "short",
            year: "numeric",
        },
    ).format(
        new Date(year, month - 1, 1),
    );
}

export default function ReportOverviewPage() {
    const params = useParams<{
        reportId: string;
    }>();

    const router = useRouter();
    const reportId = params.reportId;

    const [result, setResult] =
        useState<AnalysisResult | null>(null);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadReport(): Promise<void> {
            try {
                const stored =
                    await getReportAnalysis(
                        reportId,
                    );

                if (!stored) {
                    if (!cancelled) {
                        setError(
                            "The completed analysis could not be found. Upload and analyze the spreadsheet again.",
                        );
                    }

                    return;
                }

                if (
                    !stored.metrics ||
                    !stored.cleaning ||
                    !stored.summaries ||
                    !stored.advanced
                ) {
                    if (!cancelled) {
                        setError(
                            "The saved report is incomplete. Upload the spreadsheet again to rebuild it.",
                        );
                    }

                    return;
                }

                if (!cancelled) {
                    setResult(stored);
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : "The stored report could not be opened.",
                    );
                }
            }
        }

        void loadReport();

        return () => {
            cancelled = true;
        };
    }, [reportId]);

    const strongestMonth = useMemo(() => {
        if (!result) {
            return null;
        }

        return [...result.summaries.monthly]
            .sort(
                (left, right) =>
                    right.revenue -
                    left.revenue,
            )[0] ?? null;
    }, [result]);

    const highestReturnProduct =
        useMemo(() => {
            if (!result) {
                return null;
            }

            return result.advanced
                .productMomentum
                .products
                .filter((product) => {
                    return (
                        product.currentSalesRevenue >=
                        500 &&
                        product.currentOrders >= 5 &&
                        product.currentReturnedRevenue >=
                        100 &&
                        product.currentReturnRate !==
                        null &&
                        product.currentReturnRate >=
                        0.1
                    );
                })
                .sort(
                    (left, right) => {
                        const impactDifference =
                            right.currentReturnedRevenue -
                            left.currentReturnedRevenue;

                        if (
                            impactDifference !==
                            0
                        ) {
                            return impactDifference;
                        }

                        return (
                            (right.currentReturnRate ??
                                0) -
                            (left.currentReturnRate ??
                                0)
                        );
                    },
                )[0] ?? null;
        }, [result]);

    if (error) {
        return (
            <main className="min-h-screen bg-[#f6f6f2] px-5 py-16 text-[#191918]">
                <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7">
                    <h1 className="text-2xl font-semibold">
                        Report unavailable
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-[#696965]">
                        {error}
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-flex rounded-xl bg-[#191918] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Upload another spreadsheet
                    </Link>
                </div>
            </main>
        );
    }

    if (!result) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#f6f6f2] text-sm text-[#696965]">
                Opening report…
            </main>
        );
    }

    const {
        metrics,
        cleaning,
        summaries,
        advanced,
    } = result;

    if (!advanced) {
        return (
            <main className="min-h-screen bg-[#f6f6f2] px-5 py-16 text-[#191918]">
                <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7">
                    <h1 className="text-2xl font-semibold">
                        Report needs to be rebuilt
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-[#696965]">
                        This report was created before advanced
                        analytics were added. Upload the spreadsheet
                        again to generate the updated report.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-flex rounded-xl bg-[#191918] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Upload spreadsheet again
                    </Link>
                </div>
            </main>
        );
    }

    const {
        productMomentum,
        customerMovement,
        rfm,
        decisions,
    } = advanced;

    const topProducts =
        summaries.products.slice(0, 10);

    const topCustomers =
        summaries.customers.slice(0, 10);

    const topRegions =
        summaries.regions.slice(0, 8);

    return (
        <div className="min-h-screen bg-[#f6f6f2] text-[#191918]">
            <header className="border-b border-black/8 bg-white">
                <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
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

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium"
                    >
                        Back to review
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
                <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2457e6]">
                        Complete report
                    </p>

                    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                        Business performance overview
                    </h1>

                    <p className="mt-4 text-base leading-7 text-[#696965]">
                        A structured view of sales performance,
                        customers, products, geography, and data
                        quality.
                    </p>
                </div>

                <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        label="Average order"
                        value={money(
                            metrics.averageOrderValue,
                        )}
                    />

                    <MetricCard
                        label="Known customers"
                        value={metrics.uniqueCustomers.toLocaleString()}
                    />
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    <ReportCard
                        title="Performance summary"
                        description="The clearest overall signals in this dataset."
                    >
                        <InsightRow
                            label="Strongest month"
                            value={
                                strongestMonth
                                    ? `${monthLabel(
                                        strongestMonth.period,
                                    )} · ${money(
                                        strongestMonth.revenue,
                                    )}`
                                    : "Not available"
                            }
                        />

                        <InsightRow
                            label="Repeat customer rate"
                            value={percent(
                                metrics.repeatCustomerRate,
                            )}
                        />

                        <InsightRow
                            label="Top customer concentration"
                            value={percent(
                                metrics.topCustomerShare,
                            )}
                        />

                        <InsightRow
                            label="Top product concentration"
                            value={percent(
                                metrics.topProductShare,
                            )}
                        />
                    </ReportCard>

                    <ReportCard
                        title="Data confidence"
                        description="Coverage available for each analysis area."
                    >
                        <InsightRow
                            label="Rows accepted"
                            value={cleaning.acceptedRows.toLocaleString()}
                        />

                        <InsightRow
                            label="Rows excluded"
                            value={cleaning.rejectedRows.toLocaleString()}
                        />

                        <InsightRow
                            label="Customer coverage"
                            value={percent(
                                metrics.customerCoverage,
                            )}
                        />

                        <InsightRow
                            label="Order ID coverage"
                            value={percent(
                                metrics.orderIdCoverage,
                            )}
                        />
                    </ReportCard>
                </section>

                <section className="mt-8">
                    <ReportCard
                        title="Monthly performance"
                        description="Net revenue after returns and cancellations."
                    >
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                <tr className="border-b border-black/10 text-xs text-[#777772]">
                                    <th className="pb-3 font-medium">
                                        Period
                                    </th>
                                    <th className="pb-3 text-right font-medium">
                                        Revenue
                                    </th>
                                    <th className="pb-3 text-right font-medium">
                                        Orders
                                    </th>
                                    <th className="pb-3 text-right font-medium">
                                        Customers
                                    </th>
                                    <th className="pb-3 text-right font-medium">
                                        Returns
                                    </th>
                                </tr>
                                </thead>

                                <tbody>
                                {summaries.monthly.map(
                                    (month) => (
                                        <tr
                                            key={month.period}
                                            className="border-b border-black/6 last:border-0"
                                        >
                                            <td className="py-3 font-medium">
                                                {monthLabel(
                                                    month.period,
                                                )}
                                            </td>

                                            <td className="py-3 text-right">
                                                {money(
                                                    month.revenue,
                                                )}
                                            </td>

                                            <td className="py-3 text-right">
                                                {month.orders.toLocaleString()}
                                            </td>

                                            <td className="py-3 text-right">
                                                {month.customers.toLocaleString()}
                                            </td>

                                            <td className="py-3 text-right text-[#a42a20]">
                                                {money(
                                                    month.returnedRevenue,
                                                )}
                                            </td>
                                        </tr>
                                    ),
                                )}
                                </tbody>
                            </table>
                        </div>
                    </ReportCard>
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    <RankingTable
                        title="Top products"
                        heading="Product"
                        rows={topProducts.map(
                            (product) => ({
                                label: product.product,
                                value: money(
                                    product.revenue,
                                ),
                                detail: `${product.orders.toLocaleString()} orders`,
                            }),
                        )}
                    />

                    <RankingTable
                        title="Top customers"
                        heading="Customer"
                        rows={topCustomers.map(
                            (customer) => ({
                                label: customer.customer,
                                value: money(
                                    customer.revenue,
                                ),
                                detail: `${customer.orders.toLocaleString()} orders`,
                            }),
                        )}
                    />
                </section>

                {topRegions.length > 0 ? (
                    <section className="mt-8">
                        <RankingTable
                            title="Regional performance"
                            heading="Region"
                            rows={topRegions.map(
                                (region) => ({
                                    label: region.region,
                                    value: money(
                                        region.revenue,
                                    ),
                                    detail: `${region.orders.toLocaleString()} orders`,
                                }),
                            )}
                        />
                    </section>
                ) : null}

                {highestReturnProduct ? (
                    <section className="mt-8 rounded-2xl border border-[#ead9a8] bg-[#fff9e9] p-6">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#785810]">
                            Returns watch
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            {highestReturnProduct.product}
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#785810]">
                            This product generated{" "}
                            {money(
                                highestReturnProduct
                                    .currentReturnedRevenue,
                            )}{" "}
                            in returned revenue during the
                            current comparison period.
                        </p>

                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            <ReturnMetric
                                label="Positive sales"
                                value={money(
                                    highestReturnProduct
                                        .currentSalesRevenue,
                                )}
                            />

                            <ReturnMetric
                                label="Returned revenue"
                                value={money(
                                    highestReturnProduct
                                        .currentReturnedRevenue,
                                )}
                            />

                            <ReturnMetric
                                label="Return rate"
                                value={
                                    highestReturnProduct
                                        .currentReturnRate ===
                                    null
                                        ? "Not available"
                                        : percent(
                                            highestReturnProduct
                                                .currentReturnRate,
                                        )
                                }
                            />
                        </div>
                    </section>
                ) : (
                    <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#777772]">
                            Returns watch
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            No high-impact return issue detected
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#696965]">
                            No product met the minimum thresholds
                            for positive sales, order volume,
                            returned revenue, and return rate.
                        </p>
                    </section>
                )}

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    <ReportCard
                        title="Customer movement"
                        description={
                            customerMovement.window
                                ? `${customerMovement.window.windowDays}-day comparison against the preceding matching period.`
                                : "Not enough dated customer activity for a comparison."
                        }
                    >
                        <InsightRow
                            label="New revenue"
                            value={money(
                                customerMovement
                                    .totals.newRevenue,
                            )}
                        />

                        <InsightRow
                            label="Expansion revenue"
                            value={money(
                                customerMovement
                                    .totals.expansionRevenue,
                            )}
                        />

                        <InsightRow
                            label="Returning revenue"
                            value={money(
                                customerMovement
                                    .totals.returningRevenue,
                            )}
                        />

                        <InsightRow
                            label="Contraction"
                            value={money(
                                customerMovement
                                    .totals.contractionRevenue,
                            )}
                        />

                        <InsightRow
                            label="Lost revenue"
                            value={money(
                                customerMovement
                                    .totals.lostRevenue,
                            )}
                        />
                    </ReportCard>

                    <ReportCard
                        title="Product momentum"
                        description={
                            productMomentum.window
                                ? `${productMomentum.window.windowDays}-day product comparison.`
                                : "Not enough product history for a comparison."
                        }
                    >
                        <InsightRow
                            label="Growing products"
                            value={productMomentum.fastestGrowing.length.toLocaleString()}
                        />

                        <InsightRow
                            label="Declining products"
                            value={productMomentum.fastestDeclining.length.toLocaleString()}
                        />

                        <InsightRow
                            label="Newly active products"
                            value={productMomentum.newlyActive.length.toLocaleString()}
                        />

                        <InsightRow
                            label="Inactive products"
                            value={productMomentum.becameInactive.length.toLocaleString()}
                        />
                    </ReportCard>
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    <RankingTable
                        title="Fastest-growing products"
                        heading="Product"
                        rows={productMomentum.fastestGrowing
                            .slice(0, 10)
                            .map((product) => ({
                                label:
                                product.product,
                                value: money(
                                    product.revenueChange,
                                ),
                                detail:
                                    `${money(
                                        product.currentRevenue,
                                    )} current revenue`,
                            }))}
                    />

                    <RankingTable
                        title="Largest customer losses"
                        heading="Customer"
                        rows={customerMovement.lostCustomers
                            .slice(0, 10)
                            .map((customer) => ({
                                label:
                                customer.customer,
                                value: money(
                                    customer.previousRevenue,
                                ),
                                detail:
                                    `${customer.previousOrders.toLocaleString()} prior orders`,
                            }))}
                    />
                </section>

                <section className="mt-8">
                    <ReportCard
                        title="RFM customer segments"
                        description="Customers grouped by recency, frequency, and monetary value."
                    >
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                <tr className="border-b border-black/10 text-xs text-[#777772]">
                                    <th className="pb-3 font-medium">
                                        Segment
                                    </th>

                                    <th className="pb-3 text-right font-medium">
                                        Customers
                                    </th>

                                    <th className="pb-3 text-right font-medium">
                                        Revenue
                                    </th>

                                    <th className="pb-3 text-right font-medium">
                                        Average
                                    </th>
                                </tr>
                                </thead>

                                <tbody>
                                {rfm.segments.map(
                                    (segment) => (
                                        <tr
                                            key={
                                                segment.segment
                                            }
                                            className="border-b border-black/6 last:border-0"
                                        >
                                            <td className="py-3 font-medium capitalize">
                                                {segment.segment.replaceAll(
                                                    "_",
                                                    " ",
                                                )}
                                            </td>

                                            <td className="py-3 text-right">
                                                {segment.customers.toLocaleString()}
                                            </td>

                                            <td className="py-3 text-right">
                                                {money(
                                                    segment.revenue,
                                                )}
                                            </td>

                                            <td className="py-3 text-right">
                                                {money(
                                                    segment.averageRevenue,
                                                )}
                                            </td>
                                        </tr>
                                    ),
                                )}
                                </tbody>
                            </table>
                        </div>
                    </ReportCard>
                </section>

                <section className="mt-8">
                    <ReportCard
                        title="Decision queue"
                        description="Prioritized actions generated from the strongest evidence in this report."
                    >
                        <div className="space-y-3">
                            {decisions.length === 0 ? (
                                <p className="text-sm text-[#777772]">
                                    No major actions were detected.
                                </p>
                            ) : (
                                decisions.map(
                                    (decision) => (
                                        <article
                                            key={
                                                decision.id
                                            }
                                            className="rounded-xl border border-black/10 p-4"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#191918] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                                    {
                                        decision.priority
                                    }
                                </span>

                                                <span className="text-xs capitalize text-[#777772]">
                                    {
                                        decision.category
                                    }
                                </span>
                                            </div>

                                            <h3 className="mt-3 text-base font-semibold">
                                                {
                                                    decision.title
                                                }
                                            </h3>

                                            <p className="mt-2 text-sm leading-6 text-[#696965]">
                                                {
                                                    decision.summary
                                                }
                                            </p>

                                            <p className="mt-3 text-sm font-medium">
                                                {
                                                    decision.recommendation
                                                }
                                            </p>

                                            <div className="mt-3 space-y-1">
                                                {decision.evidence.map(
                                                    (
                                                        evidence,
                                                    ) => (
                                                        <p
                                                            key={
                                                                evidence
                                                            }
                                                            className="text-xs text-[#777772]"
                                                        >
                                                            •{" "}
                                                            {
                                                                evidence
                                                            }
                                                        </p>
                                                    ),
                                                )}
                                            </div>
                                        </article>
                                    ),
                                )
                            )}
                        </div>
                    </ReportCard>
                </section>
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

function ReportCard({
                        title,
                        description,
                        children,
                    }: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <article className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">
                {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#777772]">
                {description}
            </p>

            <div className="mt-5">
                {children}
            </div>
        </article>
    );
}

function InsightRow({
                        label,
                        value,
                    }: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start justify-between gap-5 border-b border-black/6 py-3 first:pt-0 last:border-0 last:pb-0">
            <span className="text-sm text-[#696965]">
                {label}
            </span>

            <span className="text-right text-sm font-semibold">
                {value}
            </span>
        </div>
    );
}

function RankingTable({
                          title,
                          heading,
                          rows,
                      }: {
    title: string;
    heading: string;
    rows: Array<{
        label: string;
        value: string;
        detail: string;
    }>;
}) {
    return (
        <article className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">
                {title}
            </h2>

            <div className="mt-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-black/10 pb-3 text-xs text-[#777772]">
                    <span>{heading}</span>
                    <span>Revenue</span>
                </div>

                {rows.map((row, index) => (
                    <div
                        key={`${row.label}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-black/6 py-3 last:border-0"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {row.label}
                            </p>

                            <p className="mt-1 text-xs text-[#777772]">
                                {row.detail}
                            </p>
                        </div>

                        <p className="text-sm font-semibold">
                            {row.value}
                        </p>
                    </div>
                ))}
            </div>
        </article>
    );
}

function ReturnMetric({
                          label,
                          value,
                      }: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-[#ead9a8] bg-white/60 p-4">
            <p className="text-xs text-[#785810]">
                {label}
            </p>

            <p className="mt-2 text-lg font-semibold text-[#191918]">
                {value}
            </p>
        </div>
    );
}