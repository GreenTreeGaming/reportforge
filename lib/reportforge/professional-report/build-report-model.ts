import type { AnalysisResult, DecisionAction } from "../types";
import { formatDate, formatMoney, formatMonth, formatNumber, formatPercent } from "./formatters";
import { buildExecutiveHeadline, buildExecutiveNarrative } from "./build-narrative";
import type { ProfessionalReportModel, ProfessionalReportSettings, ReportAction, ReportBridgeItem, ReportHighlight } from "./types";

function timing(priority: DecisionAction["priority"]): string {
    if (priority === "critical") return "This week";
    if (priority === "high") return "Within 14 days";
    if (priority === "medium") return "This month";
    return "Next planning cycle";
}
function mapAction(action: DecisionAction): ReportAction { return { ...action, timing: timing(action.priority) }; }
function score(a: AnalysisResult): number {
    const acceptance = a.cleaning.sourceRows ? a.cleaning.acceptedRows / a.cleaning.sourceRows : 0;
    return Math.max(0, Math.min(100, Math.round(acceptance * 35 + a.metrics.customerCoverage * 25 + a.metrics.orderIdCoverage * 25 + (a.cleaning.costCoverage ?? 0) * 15)));
}
function grade(value: number): ProfessionalReportModel["dataQuality"]["grade"] {
    if (value >= 90) return "excellent";
    if (value >= 75) return "good";
    if (value >= 55) return "limited";
    return "poor";
}
function bridge(a: AnalysisResult): ReportBridgeItem[] {
    const m = a.advanced.customerMovement;
    if (!m.window) return [];
    const previous = m.customers.reduce((sum, c) => sum + c.previousRevenue, 0);
    const current = m.customers.reduce((sum, c) => sum + c.currentRevenue, 0);
    return [
        { label: "Previous revenue", value: previous, kind: "start" },
        { label: "New customers", value: m.totals.newRevenue, kind: "increase" },
        { label: "Expansion", value: m.totals.expansionRevenue, kind: "increase" },
        { label: "Returning", value: m.totals.returningRevenue, kind: "increase" },
        { label: "Contraction", value: -m.totals.contractionRevenue, kind: "decrease" },
        { label: "Lost customers", value: -m.totals.lostRevenue, kind: "decrease" },
        { label: "Current revenue", value: current, kind: "end" },
    ];
}
function highlights(a: AnalysisResult): ReportHighlight[] {
    const month = [...a.summaries.monthly].sort((l, r) => r.revenue - l.revenue)[0];
    const growth = a.advanced.productMomentum.fastestGrowing[0];
    return [
        month ? { title: "Strongest period", detail: `${formatMonth(month.period)} generated the highest monthly net revenue.`, value: formatMoney(month.revenue) } : null,
        growth ? { title: "Leading product momentum", detail: `${growth.product} produced the largest measured product increase.`, value: formatMoney(growth.revenueChange) } : null,
        { title: "Repeat customer base", detail: "Share of known customers with more than one detected order.", value: formatPercent(a.metrics.repeatCustomerRate) },
    ].filter((item): item is ReportHighlight => item !== null);
}
function risks(a: AnalysisResult): ReportHighlight[] {
    const returned = [...a.summaries.products].filter(p => p.salesRevenue > 0 && p.returnedRevenue > 0).sort((l, r) => r.returnRate - l.returnRate)[0];
    const lost = a.advanced.customerMovement.lostCustomers[0];
    return [
        lost ? { title: "Largest customer loss", detail: `${lost.customer} generated revenue in the previous window but none in the current window.`, value: formatMoney(lost.previousRevenue) } : null,
        returned ? { title: "Highest product return ratio", detail: `${returned.product} has the highest detected return ratio among qualifying products.`, value: formatPercent(returned.returnRate) } : null,
        a.metrics.customerCoverage < .8 ? { title: "Customer-data limitation", detail: "Some customer analysis excludes transactions without a customer identifier.", value: formatPercent(a.metrics.customerCoverage) } : null,
    ].filter((item): item is ReportHighlight => item !== null);
}

export function buildProfessionalReportModel(a: AnalysisResult, s: ProfessionalReportSettings): ProfessionalReportModel {
    const m = a.advanced.customerMovement;
    const quality = score(a);
    const actions = a.advanced.decisions.map(mapAction);
    const strengths: string[] = [];
    const limitations: string[] = [];
    const acceptance = a.cleaning.acceptedRows / Math.max(a.cleaning.sourceRows, 1);
    if (acceptance >= .98) strengths.push("At least 98% of source rows were accepted for analysis."); else limitations.push(`${formatNumber(a.cleaning.rejectedRows)} source rows were excluded during cleaning.`);
    if (a.metrics.orderIdCoverage >= .9) strengths.push("Order identifiers provide strong order-level analysis coverage."); else limitations.push(`Order identifiers cover ${formatPercent(a.metrics.orderIdCoverage)} of accepted line items.`);
    if (a.metrics.customerCoverage >= .9) strengths.push("Customer identifiers provide strong customer-analysis coverage."); else limitations.push(`Customer identifiers cover ${formatPercent(a.metrics.customerCoverage)} of accepted line items.`);
    if ((a.cleaning.costCoverage ?? 0) >= .9) strengths.push("Cost coverage is sufficient for broad profitability analysis."); else limitations.push(`Cost data covers ${formatPercent(a.cleaning.costCoverage ?? 0)} of accepted rows.`);

    return {
        metadata: {
            businessName: s.businessName, title: s.reportTitle, preparedFor: s.preparedFor, preparedBy: s.preparedBy,
            reportingLabel: s.reportingLabel, generatedAt: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
            accentColor: s.accentColor,
            currentPeriod: m.window ? `${formatDate(m.window.currentStart)} – ${formatDate(m.window.currentEnd)}` : null,
            comparisonPeriod: m.window ? `${formatDate(m.window.previousStart)} – ${formatDate(m.window.previousEnd)}` : null,
        },
        executiveSummary: { headline: buildExecutiveHeadline(a), narrative: buildExecutiveNarrative(a), highlights: highlights(a), risks: risks(a), actions: actions.slice(0, 3) },
        kpis: [
            { label: "Net revenue", value: formatMoney(a.metrics.totalRevenue), detail: "After detected returns and cancellations" },
            { label: "Orders", value: formatNumber(a.metrics.orderCount), detail: `${formatPercent(a.metrics.orderIdCoverage)} order-ID coverage` },
            { label: "Average order", value: formatMoney(a.metrics.averageOrderValue), detail: `Median ${formatMoney(a.metrics.medianOrderValue)}` },
            { label: "Known customers", value: formatNumber(a.metrics.uniqueCustomers), detail: `${formatPercent(a.metrics.customerCoverage)} customer coverage` },
            ...(a.metrics.grossProfit !== null ? [{ label: "Gross profit", value: formatMoney(a.metrics.grossProfit), detail: `${formatPercent(a.metrics.grossMargin)} gross margin` }] : []),
        ],
        revenue: { monthly: a.summaries.monthly.map(x => ({ label: formatMonth(x.period), value: x.revenue })), bridge: bridge(a) },
        customers: {
            movement: [
                { label: "New", value: m.newCustomers.length, amount: m.totals.newRevenue },
                { label: "Expanded", value: m.expandedCustomers.length, amount: m.totals.expansionRevenue },
                { label: "Returning", value: m.returningCustomers.length, amount: m.totals.returningRevenue },
                { label: "Contracted", value: m.contractedCustomers.length, amount: m.totals.contractionRevenue },
                { label: "Lost", value: m.lostCustomers.length, amount: m.totals.lostRevenue },
            ],
            rfmSegments: a.advanced.rfm.segments.map(x => ({ label: x.segment.replaceAll("_", " "), value: x.customers, amount: x.revenue })),
            largestLosses: m.lostCustomers.slice(0, 10).map(x => ({ label: x.customer, value: x.previousRevenue, detail: `${x.previousOrders.toLocaleString()} prior orders` })),
        },
        products: {
            topProducts: a.summaries.products.slice(0, 10).map(x => ({ label: x.product, value: x.revenue, detail: `${x.orders.toLocaleString()} orders` })),
            growingProducts: a.advanced.productMomentum.fastestGrowing.slice(0, 10).map(x => ({ label: x.product, value: x.revenueChange, detail: `${formatMoney(x.currentRevenue)} current revenue` })),
            decliningProducts: a.advanced.productMomentum.fastestDeclining.slice(0, 10).map(x => ({ label: x.product, value: Math.abs(x.revenueChange), detail: `${formatMoney(x.currentRevenue)} current revenue` })),
            returnRisks: [...a.summaries.products].filter(x => x.returnedRevenue > 0).sort((l, r) => r.returnRate - l.returnRate).slice(0, 10).map(x => ({ label: x.product, value: x.returnedRevenue, detail: `${formatPercent(x.returnRate)} return ratio` })),
        },
        regions: a.summaries.regions.slice(0, 10).map(x => ({ label: x.region, value: x.revenue, detail: `${x.orders.toLocaleString()} orders · ${x.customers.toLocaleString()} customers` })),
        actions,
        dataQuality: { score: quality, grade: grade(quality), strengths, limitations, assumptions: [
                "Revenue values are treated as net transaction values after detected returns and cancellations.",
                "Customer and order analysis depends on the consistency of mapped identifiers.",
                "Comparison windows use the latest available dated activity and the immediately preceding matching period.",
                "Recommendations are deterministic signals generated from the uploaded dataset, not guarantees of future performance.",
            ] },
        availability: { customer: a.metrics.customerCoverage > 0 && a.advanced.rfm.customers.length > 0, products: a.summaries.products.length > 0, regions: a.summaries.regions.length > 0, profitability: a.metrics.grossProfit !== null, comparison: m.window !== null },
    };
}
