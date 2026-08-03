import type { DecisionPriority, RfmSegment } from "@/lib/reportforge/types";

export type ReportSettings = {
    businessName: string;
    reportTitle: string;
    preparedFor: string | null;
    preparedBy: string | null;
    logoDataUrl: string | null;
    accentColor: string;
    reportingLabel: string;
    executiveNote: string | null;
    includeMethodology: boolean;
    pageSize: "a4" | "letter";
};

export type Kpi = {
    id: string;
    label: string;
    value: string;
    change: string | null;
    direction: "up" | "down" | "flat" | "none";
    context: string;
};

export type Ranking = {
    id: string;
    label: string;
    value: number;
    formattedValue: string;
    detail: string;
};

export type ReportAction = {
    id: string;
    priority: DecisionPriority;
    category: string;
    title: string;
    summary: string;
    recommendation: string;
    evidence: string[];
    impact: number | null;
    timing: string;
};

export type ReportBridgeItem = {
    id: string;
    label: string;
    value: number;
    kind: "start" | "up" | "down" | "end";
};

export type ReportHighlight = {
    id: string;
    title: string;
    detail: string;
    value: string;
    tone: "positive" | "warning" | "neutral";
};

export type ReportDriver = {
    id: string;
    label: string;
    impact: number;
    description: string;
};

export type ReportModel = {
    metadata: ReportSettings & {
        generatedAt: string;
        currentPeriod: string | null;
        comparisonPeriod: string | null;
    };
    headline: string;
    narrative: string;
    highlights: ReportHighlight[];
    risks: ReportHighlight[];
    kpis: Kpi[];
    monthly: { id: string; label: string; value: number }[];
    bridge: ReportBridgeItem[];
    drivers: ReportDriver[];
    customer: {
        available: boolean;
        repeatRate: number;
        coverage: number;
        topShare: number;
        movement: {
            id: string;
            label: string;
            count: number;
            amount: number;
            tone: "positive" | "negative" | "neutral";
        }[];
        segments: {
            id: RfmSegment;
            label: string;
            customers: number;
            revenue: number;
        }[];
        losses: Ranking[];
        topCustomers: Ranking[];
    };
    products: {
        available: boolean;
        top: Ranking[];
        growing: Ranking[];
        declining: Ranking[];
        returns: Ranking[];
        topShare: number;
    };
    regions: {
        available: boolean;
        items: Ranking[];
    };
    profit: {
        available: boolean;
        grossProfit: number | null;
        grossMargin: number | null;
        totalCost: number | null;
        costCoverage: number;
    };
    actions: ReportAction[];
    quality: {
        score: number;
        grade: "Excellent" | "Good" | "Limited" | "Poor";
        strengths: string[];
        limitations: string[];
        assumptions: string[];
        rows: number;
        accepted: number;
        excluded: number;
        customerCoverage: number;
        orderCoverage: number;
        costCoverage: number;
    };
};
