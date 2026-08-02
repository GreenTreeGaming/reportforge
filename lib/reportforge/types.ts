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
    customer: string;
    product: string;
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

export type CleanSalesRow = {
    sourceRow: number;
    date: Date;
    customer: string;
    product: string;
    revenue: number;
    cost: number | null;
    profit: number | null;
};

export type RejectedSalesRow = {
    sourceRow: number;
    reason: string;
    original: RawRow;
};

export type SalesMetrics = {
    totalRevenue: number;
    totalCost: number | null;
    grossProfit: number | null;
    grossMargin: number | null;
    transactionCount: number;
    averageOrderValue: number;
    medianOrderValue: number;
    uniqueCustomers: number;
    uniqueProducts: number;
    repeatCustomerRate: number;
    topCustomerShare: number;
    topProductShare: number;
    anomalyCount: number;
};