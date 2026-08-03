import type {
    AnalysisResult,
    DecisionAction,
} from "../types";

import {
    buildExecutiveHeadline,
    buildExecutiveNarrative,
} from "./build-narrative";

import {
    clamp,
    dateLabel,
    money,
    monthLabel,
    number,
    pct,
    signedPct,
} from "./formatters";

import type {
    Kpi,
    Ranking,
    ReportAction,
    ReportBridgeItem,
    ReportDriver,
    ReportHighlight,
    ReportModel,
    ReportSettings,
} from "./types";

type ComparisonWindow = {
    previousRevenue: number;
    currentRevenue: number;
    previousOrders: number;
    currentOrders: number;
    previousCustomers: number;
    currentCustomers: number;
};

function timing(
    priority: DecisionAction["priority"],
): string {
    switch (priority) {
        case "critical":
            return "This week";
        case "high":
            return "Within 14 days";
        case "medium":
            return "This month";
        case "low":
            return "Next planning cycle";
    }
}

function mapAction(
    action: DecisionAction,
): ReportAction {
    return {
        id: action.id,
        priority: action.priority,
        category: action.category,
        title: action.title,
        summary: action.summary,
        recommendation: action.recommendation,
        evidence: action.evidence,
        impact: action.estimatedImpact,
        timing: timing(action.priority),
    };
}

function grade(
    score: number,
): ReportModel["quality"]["grade"] {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 55) return "Limited";
    return "Poor";
}

function safeRate(
    current: number,
    previous: number,
): number | null {
    if (previous === 0) {
        return null;
    }

    return (current - previous) / Math.abs(previous);
}

function getComparison(
    analysis: AnalysisResult,
): ComparisonWindow | null {
    const monthly = [...analysis.summaries.monthly].sort(
        (left, right) =>
            left.period.localeCompare(right.period),
    );

    if (monthly.length < 2) {
        return null;
    }

    const windowSize = Math.floor(monthly.length / 2);

    if (windowSize < 1) {
        return null;
    }

    const previous = monthly.slice(
        monthly.length - windowSize * 2,
        monthly.length - windowSize,
    );

    const current = monthly.slice(
        monthly.length - windowSize,
    );

    return {
        previousRevenue: previous.reduce(
            (total, item) => total + item.revenue,
            0,
        ),
        currentRevenue: current.reduce(
            (total, item) => total + item.revenue,
            0,
        ),
        previousOrders: previous.reduce(
            (total, item) => total + item.orders,
            0,
        ),
        currentOrders: current.reduce(
            (total, item) => total + item.orders,
            0,
        ),
        previousCustomers: previous.reduce(
            (total, item) => total + item.customers,
            0,
        ),
        currentCustomers: current.reduce(
            (total, item) => total + item.customers,
            0,
        ),
    };
}

function buildBridge(
    analysis: AnalysisResult,
    previousRevenue: number | null,
    currentRevenue: number,
): ReportBridgeItem[] {
    if (previousRevenue === null) {
        return [];
    }

    const movement =
        analysis.advanced.customerMovement;

    return [
        {
            id: "previous",
            label: "Previous revenue",
            value: previousRevenue,
            kind: "start",
        },
        {
            id: "new",
            label: "New customers",
            value: movement.totals.newRevenue,
            kind: "up",
        },
        {
            id: "expansion",
            label: "Expansion",
            value: movement.totals.expansionRevenue,
            kind: "up",
        },
        {
            id: "returning",
            label: "Returning",
            value: movement.totals.returningRevenue,
            kind: "up",
        },
        {
            id: "contraction",
            label: "Contraction",
            value: -movement.totals.contractionRevenue,
            kind: "down",
        },
        {
            id: "lost",
            label: "Lost customers",
            value: -movement.totals.lostRevenue,
            kind: "down",
        },
        {
            id: "current",
            label: "Current revenue",
            value: currentRevenue,
            kind: "end",
        },
    ];
}

function buildDrivers(
    comparison: ComparisonWindow | null,
): ReportDriver[] {
    if (
        !comparison ||
        comparison.previousCustomers <= 0 ||
        comparison.currentCustomers <= 0 ||
        comparison.previousOrders <= 0 ||
        comparison.currentOrders <= 0
    ) {
        return [];
    }

    const previousFrequency =
        comparison.previousOrders /
        comparison.previousCustomers;

    const currentFrequency =
        comparison.currentOrders /
        comparison.currentCustomers;

    const previousAov =
        comparison.previousRevenue /
        comparison.previousOrders;

    const currentAov =
        comparison.currentRevenue /
        comparison.currentOrders;

    return [
        {
            id: "customers",
            label: "Active customer volume",
            impact:
                (comparison.currentCustomers -
                    comparison.previousCustomers) *
                previousFrequency *
                previousAov,
            description:
                "Revenue movement associated with the number of active customers.",
        },
        {
            id: "frequency",
            label: "Orders per customer",
            impact:
                comparison.currentCustomers *
                (currentFrequency - previousFrequency) *
                previousAov,
            description:
                "Revenue movement associated with customer purchase frequency.",
        },
        {
            id: "aov",
            label: "Average order value",
            impact:
                comparison.currentCustomers *
                currentFrequency *
                (currentAov - previousAov),
            description:
                "Revenue movement associated with average revenue per order.",
        },
    ];
}

function ranking({
                     id,
                     label,
                     value,
                     detail,
                 }: {
    id: string;
    label: string;
    value: number;
    detail: string;
}): Ranking {
    return {
        id,
        label,
        value,
        formattedValue: money(value),
        detail,
    };
}

function buildHighlights(
    analysis: AnalysisResult,
    changeRate: number | null,
): {
    highlights: ReportHighlight[];
    risks: ReportHighlight[];
} {
    const highlights: ReportHighlight[] = [];
    const risks: ReportHighlight[] = [];

    const strongestMonth =
        [...analysis.summaries.monthly].sort(
            (left, right) =>
                right.revenue - left.revenue,
        )[0];

    if (strongestMonth) {
        highlights.push({
            id: "strongest-period",
            title: "Strongest period",
            detail:
                `${monthLabel(strongestMonth.period)} generated ` +
                "the highest monthly net revenue.",
            value: money(strongestMonth.revenue),
            tone: "positive",
        });
    }

    const growth =
        analysis.advanced.productMomentum.fastestGrowing[0];

    if (growth) {
        highlights.push({
            id: "product-growth",
            title: "Leading product momentum",
            detail:
                `${growth.product} produced the largest ` +
                "measured product increase.",
            value: money(growth.revenueChange),
            tone: "positive",
        });
    }

    if (changeRate !== null && changeRate > 0) {
        highlights.push({
            id: "period-growth",
            title: "Period revenue growth",
            detail:
                "Net revenue increased against the matching prior window.",
            value: signedPct(changeRate),
            tone: "positive",
        });
    }

    const lost =
        analysis.advanced.customerMovement.lostCustomers[0];

    if (lost) {
        risks.push({
            id: "customer-loss",
            title: "Largest customer loss",
            detail:
                `${lost.customer} generated revenue previously ` +
                "but none in the current window.",
            value: money(lost.previousRevenue),
            tone: "warning",
        });
    }

    const returned =
        [...analysis.summaries.products]
            .filter(
                (product) =>
                    product.salesRevenue > 0 &&
                    product.returnedRevenue > 0,
            )
            .sort(
                (left, right) =>
                    right.returnRate - left.returnRate,
            )[0];

    if (returned) {
        risks.push({
            id: "return-risk",
            title: "Highest product return ratio",
            detail:
                `${returned.product} has the highest detected ` +
                "return ratio among qualifying products.",
            value: pct(returned.returnRate),
            tone: "warning",
        });
    }

    if (analysis.metrics.customerCoverage < 0.8) {
        risks.push({
            id: "customer-coverage",
            title: "Customer-data limitation",
            detail:
                "Some customer analysis excludes rows without a customer identifier.",
            value: pct(analysis.metrics.customerCoverage),
            tone: "warning",
        });
    }

    return {
        highlights: highlights.slice(0, 3),
        risks: risks.slice(0, 3),
    };
}

function buildKpis(
    analysis: AnalysisResult,
    comparison: ComparisonWindow | null,
): Kpi[] {
    const currentRevenue =
        comparison?.currentRevenue ??
        analysis.metrics.totalRevenue;

    const revenueRate = comparison
        ? safeRate(
            comparison.currentRevenue,
            comparison.previousRevenue,
        )
        : null;

    const orderRate = comparison
        ? safeRate(
            comparison.currentOrders,
            comparison.previousOrders,
        )
        : null;

    const currentAov =
        comparison && comparison.currentOrders > 0
            ? comparison.currentRevenue /
            comparison.currentOrders
            : analysis.metrics.averageOrderValue;

    const previousAov =
        comparison && comparison.previousOrders > 0
            ? comparison.previousRevenue /
            comparison.previousOrders
            : null;

    const aovRate =
        previousAov === null
            ? null
            : safeRate(currentAov, previousAov);

    const customerRate = comparison
        ? safeRate(
            comparison.currentCustomers,
            comparison.previousCustomers,
        )
        : null;

    function direction(
        rate: number | null,
    ): Kpi["direction"] {
        if (rate === null) return "none";
        if (Math.abs(rate) < 0.005) return "flat";
        return rate > 0 ? "up" : "down";
    }

    return [
        {
            id: "revenue",
            label: "Net revenue",
            value: money(currentRevenue),
            change:
                revenueRate === null
                    ? null
                    : signedPct(revenueRate),
            direction: direction(revenueRate),
            context:
                "After detected returns and cancellations",
        },
        {
            id: "orders",
            label: "Orders",
            value: number(
                comparison?.currentOrders ??
                analysis.metrics.orderCount,
            ),
            change:
                orderRate === null
                    ? null
                    : signedPct(orderRate),
            direction: direction(orderRate),
            context:
                `${pct(
                    analysis.metrics.orderIdCoverage,
                )} order-ID coverage`,
        },
        {
            id: "aov",
            label: "Average order",
            value: money(currentAov),
            change:
                aovRate === null
                    ? null
                    : signedPct(aovRate),
            direction: direction(aovRate),
            context:
                `Median ${money(
                    analysis.metrics.medianOrderValue,
                )}`,
        },
        {
            id: "customers",
            label: "Known customers",
            value: number(
                analysis.metrics.uniqueCustomers,
            ),
            change:
                customerRate === null
                    ? null
                    : signedPct(customerRate),
            direction: direction(customerRate),
            context:
                `${pct(
                    analysis.metrics.customerCoverage,
                )} customer coverage`,
        },
        {
            id: "repeat",
            label: "Repeat customer rate",
            value: pct(
                analysis.metrics.repeatCustomerRate,
            ),
            change: null,
            direction: "none",
            context:
                "Share of known customers with more than one detected order",
        },
    ];
}

export function buildProfessionalReportModel(
    analysis: AnalysisResult,
    settings: ReportSettings,
): ReportModel {
    const comparison = getComparison(analysis);

    const currentRevenue =
        comparison?.currentRevenue ??
        analysis.metrics.totalRevenue;

    const previousRevenue =
        comparison?.previousRevenue ?? null;

    const revenueChange =
        previousRevenue === null
            ? null
            : currentRevenue - previousRevenue;

    const revenueChangeRate =
        previousRevenue === null
            ? null
            : safeRate(
                currentRevenue,
                previousRevenue,
            );

    const reportDrivers = buildDrivers(comparison);

    const primaryDriver =
        [...reportDrivers].sort(
            (left, right) =>
                Math.abs(right.impact) -
                Math.abs(left.impact),
        )[0];

    const acceptance =
        analysis.cleaning.acceptedRows /
        Math.max(analysis.cleaning.sourceRows, 1);

    const qualityScore = Math.round(
        clamp(
            acceptance * 35 +
            analysis.metrics.customerCoverage * 20 +
            analysis.metrics.orderIdCoverage * 25 +
            (analysis.cleaning.costCoverage ?? 0) * 10 +
            (analysis.summaries.monthly.length >= 6
                ? 1
                : analysis.summaries.monthly.length >= 2
                    ? 0.7
                    : 0.35) *
            10,
            0,
            100,
        ),
    );

    const strengths: string[] = [];
    const limitations: string[] = [];

    if (acceptance >= 0.98) {
        strengths.push(
            "At least 98% of source rows were accepted for analysis.",
        );
    } else {
        limitations.push(
            `${number(
                analysis.cleaning.rejectedRows,
            )} source rows were excluded during cleaning.`,
        );
    }

    if (analysis.metrics.orderIdCoverage >= 0.9) {
        strengths.push(
            "Order identifiers provide strong order-level analysis coverage.",
        );
    } else {
        limitations.push(
            `Order identifiers cover ${pct(
                analysis.metrics.orderIdCoverage,
            )} of accepted line items.`,
        );
    }

    if (analysis.metrics.customerCoverage >= 0.9) {
        strengths.push(
            "Customer identifiers provide strong customer-analysis coverage.",
        );
    } else {
        limitations.push(
            `Customer identifiers cover ${pct(
                analysis.metrics.customerCoverage,
            )} of accepted line items.`,
        );
    }

    if ((analysis.cleaning.costCoverage ?? 0) >= 0.9) {
        strengths.push(
            "Cost coverage is sufficient for broad profitability analysis.",
        );
    } else {
        limitations.push(
            `Cost data covers ${pct(
                analysis.cleaning.costCoverage ?? 0,
            )} of accepted rows.`,
        );
    }

    const movement =
        analysis.advanced.customerMovement;

    const highlightData = buildHighlights(
        analysis,
        revenueChangeRate,
    );

    const currentPeriod = movement.window
        ? `${dateLabel(
            movement.window.currentStart,
        )} – ${dateLabel(
            movement.window.currentEnd,
        )}`
        : null;

    const comparisonPeriod = movement.window
        ? `${dateLabel(
            movement.window.previousStart,
        )} – ${dateLabel(
            movement.window.previousEnd,
        )}`
        : null;

    return {
        metadata: {
            ...settings,
            generatedAt: new Date().toISOString(),
            currentPeriod,
            comparisonPeriod,
        },

        headline: buildExecutiveHeadline(
            currentRevenue,
            revenueChangeRate,
        ),

        narrative: buildExecutiveNarrative(
            currentRevenue,
            revenueChange,
            revenueChangeRate,
            primaryDriver,
            highlightData.risks[0]?.detail,
        ),

        highlights: highlightData.highlights,
        risks: highlightData.risks,
        kpis: buildKpis(analysis, comparison),

        monthly: [...analysis.summaries.monthly]
            .sort(
                (left, right) =>
                    left.period.localeCompare(
                        right.period,
                    ),
            )
            .map((period) => ({
                id: period.period,
                label: monthLabel(period.period),
                value: period.revenue,
            })),

        bridge: buildBridge(
            analysis,
            previousRevenue,
            currentRevenue,
        ),

        drivers: reportDrivers,

        customer: {
            available:
                analysis.metrics.customerCoverage > 0,
            repeatRate:
            analysis.metrics.repeatCustomerRate,
            coverage:
            analysis.metrics.customerCoverage,
            topShare:
            analysis.metrics.topCustomerShare,
            movement: [
                {
                    id: "new",
                    label: "New",
                    count:
                    movement.newCustomers.length,
                    amount:
                    movement.totals.newRevenue,
                    tone: "positive",
                },
                {
                    id: "expanded",
                    label: "Expanded",
                    count:
                    movement.expandedCustomers.length,
                    amount:
                    movement.totals.expansionRevenue,
                    tone: "positive",
                },
                {
                    id: "returning",
                    label: "Returning",
                    count:
                    movement.returningCustomers.length,
                    amount:
                    movement.totals.returningRevenue,
                    tone: "positive",
                },
                {
                    id: "contracted",
                    label: "Contracted",
                    count:
                    movement.contractedCustomers.length,
                    amount:
                    movement.totals.contractionRevenue,
                    tone: "negative",
                },
                {
                    id: "lost",
                    label: "Lost",
                    count:
                    movement.lostCustomers.length,
                    amount:
                    movement.totals.lostRevenue,
                    tone: "negative",
                },
            ],
            segments:
                analysis.advanced.rfm.segments.map(
                    (segment) => ({
                        id: segment.segment,
                        label: segment.segment
                            .replaceAll("_", " ")
                            .replace(
                                /\b\w/g,
                                (character) =>
                                    character.toUpperCase(),
                            ),
                        customers: segment.customers,
                        revenue: segment.revenue,
                    }),
                ),
            losses:
                movement.lostCustomers
                    .slice(0, 10)
                    .map((customer) =>
                        ranking({
                            id: customer.customer,
                            label: customer.customer,
                            value:
                            customer.previousRevenue,
                            detail:
                                `${number(
                                    customer.previousOrders,
                                )} prior orders`,
                        }),
                    ),
            topCustomers:
                analysis.summaries.customers
                    .slice(0, 10)
                    .map((customer) =>
                        ranking({
                            id: customer.customer,
                            label: customer.customer,
                            value: customer.revenue,
                            detail:
                                `${number(
                                    customer.orders,
                                )} orders`,
                        }),
                    ),
        },

        products: {
            available:
                analysis.summaries.products.length > 0,
            top:
                analysis.summaries.products
                    .slice(0, 10)
                    .map((product) =>
                        ranking({
                            id: product.product,
                            label: product.product,
                            value: product.revenue,
                            detail:
                                `${number(
                                    product.orders,
                                )} orders · ${pct(
                                    product.returnRate,
                                )} returns`,
                        }),
                    ),
            growing:
                analysis.advanced.productMomentum.fastestGrowing
                    .slice(0, 10)
                    .map((product) =>
                        ranking({
                            id: product.product,
                            label: product.product,
                            value:
                            product.revenueChange,
                            detail:
                                `${money(
                                    product.currentRevenue,
                                )} current revenue`,
                        }),
                    ),
            declining:
                analysis.advanced.productMomentum.fastestDeclining
                    .slice(0, 10)
                    .map((product) =>
                        ranking({
                            id: product.product,
                            label: product.product,
                            value: Math.abs(
                                product.revenueChange,
                            ),
                            detail:
                                `${money(
                                    product.currentRevenue,
                                )} current revenue`,
                        }),
                    ),
            returns:
                [...analysis.summaries.products]
                    .filter(
                        (product) =>
                            product.returnedRevenue > 0,
                    )
                    .sort(
                        (left, right) =>
                            right.returnRate -
                            left.returnRate,
                    )
                    .slice(0, 10)
                    .map((product) =>
                        ranking({
                            id: product.product,
                            label: product.product,
                            value:
                            product.returnedRevenue,
                            detail:
                                `${pct(
                                    product.returnRate,
                                )} return ratio`,
                        }),
                    ),
            topShare:
            analysis.metrics.topProductShare,
        },

        regions: {
            available:
                analysis.summaries.regions.length > 0,
            items:
                analysis.summaries.regions
                    .slice(0, 10)
                    .map((region) =>
                        ranking({
                            id: region.region,
                            label: region.region,
                            value: region.revenue,
                            detail:
                                `${number(
                                    region.orders,
                                )} orders · ${number(
                                    region.customers,
                                )} customers`,
                        }),
                    ),
        },

        profit: {
            available:
                analysis.metrics.grossProfit !== null,
            grossProfit:
            analysis.metrics.grossProfit,
            grossMargin:
            analysis.metrics.grossMargin,
            totalCost:
            analysis.metrics.totalCost,
            costCoverage:
                analysis.cleaning.costCoverage ?? 0,
        },

        actions:
            analysis.advanced.decisions
                .slice(0, 10)
                .map(mapAction),

        quality: {
            score: qualityScore,
            grade: grade(qualityScore),
            strengths:
                strengths.length > 0
                    ? strengths
                    : [
                        "Core revenue and product fields were available for analysis.",
                    ],
            limitations:
                limitations.length > 0
                    ? limitations
                    : [
                        "No major data-coverage limitation was detected.",
                    ],
            assumptions: [
                "Revenue values are treated as net transaction values after detected returns and cancellations.",
                "Customer and order analysis depends on the consistency of mapped identifiers.",
                "Comparison windows use the latest available dated activity and the immediately preceding matching period.",
                "Recommendations are deterministic signals generated from the uploaded dataset, not guarantees of future performance.",
            ],
            rows: analysis.cleaning.sourceRows,
            accepted: analysis.cleaning.acceptedRows,
            excluded: analysis.cleaning.rejectedRows,
            customerCoverage:
            analysis.metrics.customerCoverage,
            orderCoverage:
            analysis.metrics.orderIdCoverage,
            costCoverage:
                analysis.cleaning.costCoverage ?? 0,
        },
    };
}
