export type RawRow = Record<string, unknown>;

export type DirectNumericMapping = {
    mode: "column";
    column: string;
};

export type MultiplyNumericMapping = {
    mode: "multiply";
    leftColumn: string;
    rightColumn: string;
};

export type NoNumericMapping = {
    mode: "none";
};

export type NumericFieldMapping =
    | DirectNumericMapping
    | MultiplyNumericMapping
    | NoNumericMapping;

export type ColumnMapping = {
    date: string;
    customer: string | null;
    product: string;
    orderId: string | null;
    region: string | null;
    revenue: NumericFieldMapping;
    cost: NumericFieldMapping;
};

export type ParsedSpreadsheet = {
    filename: string;
    sheetName: string | null;
    rows: RawRow[];
    columns: string[];
    warnings: string[];
};

export type InspectSpreadsheetResponse = {
    reportId: string;
    filename: string;
    sheetName: string | null;
    rowCount: number;
    columnCount: number;
    columns: string[];
    preview: RawRow[];
    warnings: string[];
};

export type ApiErrorResponse = {
    message: string;
};

export type TransactionKind =
    | "sale"
    | "return"
    | "cancellation";

export type CleanSalesRow = {
    sourceRow: number;
    date: string;
    customer: string | null;
    product: string;
    orderId: string | null;
    region: string | null;
    revenue: number;
    cost: number | null;
    profit: number | null;
    transactionKind: TransactionKind;
    customerAnalysisEligible: boolean;
    orderAnalysisEligible: boolean;
};

export type RejectionReason =
    | "missing_date"
    | "invalid_date"
    | "missing_customer"
    | "missing_product"
    | "missing_revenue"
    | "invalid_revenue";

export type RejectedSalesRow = {
    sourceRow: number;
    reason: RejectionReason;
    message: string;
    original: RawRow;
};

export type CleaningSummary = {
    sourceRows: number;
    acceptedRows: number;
    rejectedRows: number;
    salesRows: number;
    returnRows: number;
    costCoverage: number;
};

export type CleaningResult = {
    rows: CleanSalesRow[];
    rejectedRows: RejectedSalesRow[];
    summary: CleaningSummary;
};

export type SalesMetrics = {
    totalRevenue: number;
    totalCost: number | null;
    grossProfit: number | null;
    grossMargin: number | null;

    lineItemCount: number;
    orderCount: number | null;

    averageLineValue: number;
    averageOrderValue: number | null;
    medianOrderValue: number | null;

    uniqueCustomers: number;
    uniqueProducts: number;

    customerCoverage: number;
    orderIdCoverage: number;

    repeatCustomerRate: number;
    topCustomerShare: number;
    topProductShare: number;
    anomalyCount: number;
};

export type PeriodSummary = {
    period: string;
    revenue: number;
    salesRevenue: number;
    returnedRevenue: number;
    lineItems: number;
    orders: number;
    customers: number;
};

export type ProductSummary = {
    product: string;
    revenue: number;
    salesRevenue: number;
    returnedRevenue: number;
    lineItems: number;
    orders: number;
    customers: number;
    returnRate: number;
};

export type CustomerSummary = {
    customer: string;
    revenue: number;
    orders: number;
    lineItems: number;
    products: number;
    firstPurchase: string;
    lastPurchase: string;
    averageOrderValue: number;
};

export type RegionSummary = {
    region: string;
    revenue: number;
    orders: number;
    customers: number;
    lineItems: number;
};

export type ReportSummaries = {
    monthly: PeriodSummary[];
    products: ProductSummary[];
    customers: CustomerSummary[];
    regions: RegionSummary[];
};

export type AnalysisResult = {
    metrics: SalesMetrics;
    cleaning: CleaningSummary;
    summaries: ReportSummaries;
    advanced: AdvancedAnalytics;

    rejectedRows: Array<{
        sourceRow: number;
        reason: string;
        message: string;
    }>;

    preview: CleanSalesRow[];
    message?: string;
};

export type ComparisonWindow = {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
    windowDays: number;
};

export type ProductMomentumStatus =
    | "new"
    | "growing"
    | "stable"
    | "declining"
    | "inactive";

export type ProductMomentum = {
    product: string;
    status: ProductMomentumStatus;

    currentRevenue: number;
    previousRevenue: number;
    revenueChange: number;
    revenueChangeRate: number | null;

    currentOrders: number;
    previousOrders: number;
    orderChange: number;

    currentCustomers: number;
    previousCustomers: number;

    currentReturnedRevenue: number;
    currentReturnRate: number;

    shareOfCurrentRevenue: number;
};

export type ProductMomentumResult = {
    window: ComparisonWindow | null;
    products: ProductMomentum[];
    fastestGrowing: ProductMomentum[];
    fastestDeclining: ProductMomentum[];
    newlyActive: ProductMomentum[];
    becameInactive: ProductMomentum[];
};

export type CustomerMovementStatus =
    | "new"
    | "retained"
    | "expanded"
    | "contracted"
    | "returning"
    | "lost";

export type CustomerMovement = {
    customer: string;
    status: CustomerMovementStatus;

    currentRevenue: number;
    previousRevenue: number;
    revenueChange: number;
    revenueChangeRate: number | null;

    currentOrders: number;
    previousOrders: number;

    currentProducts: number;
    previousProducts: number;

    firstPurchase: string;
    lastPurchase: string;
};

export type CustomerMovementTotals = {
    newRevenue: number;
    retainedRevenue: number;
    expansionRevenue: number;
    contractionRevenue: number;
    returningRevenue: number;
    lostRevenue: number;
};

export type CustomerMovementResult = {
    window: ComparisonWindow | null;
    customers: CustomerMovement[];
    totals: CustomerMovementTotals;

    newCustomers: CustomerMovement[];
    expandedCustomers: CustomerMovement[];
    contractedCustomers: CustomerMovement[];
    returningCustomers: CustomerMovement[];
    lostCustomers: CustomerMovement[];
};

export type RfmSegment =
    | "champions"
    | "loyal"
    | "potential_loyalists"
    | "new_customers"
    | "promising"
    | "need_attention"
    | "at_risk"
    | "hibernating";

export type RfmCustomer = {
    customer: string;

    recencyDays: number;
    frequency: number;
    monetary: number;

    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;

    totalScore: number;
    segment: RfmSegment;

    firstPurchase: string;
    lastPurchase: string;
};

export type RfmSegmentSummary = {
    segment: RfmSegment;
    customers: number;
    revenue: number;
    averageRevenue: number;
};

export type RfmResult = {
    analysisDate: string | null;
    customers: RfmCustomer[];
    segments: RfmSegmentSummary[];
};

export type DecisionPriority =
    | "critical"
    | "high"
    | "medium"
    | "low";

export type DecisionCategory =
    | "customer"
    | "product"
    | "returns"
    | "growth"
    | "concentration"
    | "data_quality";

export type DecisionAction = {
    id: string;
    priority: DecisionPriority;
    category: DecisionCategory;

    title: string;
    summary: string;
    recommendation: string;

    evidence: string[];
    estimatedImpact: number | null;
};

export type AdvancedAnalytics = {
    productMomentum: ProductMomentumResult;
    customerMovement: CustomerMovementResult;
    rfm: RfmResult;
    decisions: DecisionAction[];
};