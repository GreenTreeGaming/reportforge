from __future__ import annotations

from io import BytesIO

import pandas as pd
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from reportforge.models import SalesMetrics

HEADER_FILL = PatternFill("solid", fgColor="5B21B6")
HEADER_FONT = Font(color="FFFFFF", bold=True)
TITLE_FONT = Font(size=18, bold=True, color="5B21B6")


def _style_table_sheet(worksheet) -> None:
    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions
    for cell in worksheet[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center")
    for column_cells in worksheet.columns:
        values = [str(cell.value or "") for cell in column_cells]
        worksheet.column_dimensions[get_column_letter(column_cells[0].column)].width = min(max(map(len, values)) + 2, 42)


def create_excel_report(clean_data, rejected_data, metrics: SalesMetrics, summaries) -> bytes:
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        clean_export = clean_data.drop(columns=["_source_row"], errors="ignore").copy()
        clean_export["date"] = clean_export["date"].dt.date
        clean_export.to_excel(writer, sheet_name="Clean Data", index=False)
        for key, sheet in [("monthly", "Monthly"), ("products", "Products"), ("customers", "Customers"), ("weekdays", "Weekdays"), ("anomalies", "Anomalies")]:
            summaries[key].to_excel(writer, sheet_name=sheet, index=False)
        if not rejected_data.empty:
            rejected_data.to_excel(writer, sheet_name="Rejected Rows", index=False)

        workbook = writer.book
        summary = workbook.create_sheet("Executive Summary", 0)
        summary["A1"] = "ReportForge Business Performance Report"
        summary["A1"].font = TITLE_FONT
        summary.append([])
        summary.append(["Metric", "Value"])
        rows = [
            ("Total revenue", metrics.total_revenue), ("Total cost", metrics.total_cost),
            ("Gross profit", metrics.gross_profit), ("Gross margin", metrics.gross_margin),
            ("Transactions", metrics.transaction_count), ("Average order", metrics.average_order_value),
            ("Median order", metrics.median_order_value), ("Unique customers", metrics.unique_customers),
            ("Unique products", metrics.unique_products), ("Repeat customer rate", metrics.repeat_customer_rate),
            ("Top customer share", metrics.top_customer_share), ("Top product share", metrics.top_product_share),
            ("Latest revenue growth", metrics.revenue_growth), ("Latest profit growth", metrics.profit_growth),
            ("Anomaly count", metrics.anomaly_count), ("Rejected rows", len(rejected_data)),
        ]
        for row in rows:
            summary.append(row)
        for cell in summary[3]:
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
        summary.column_dimensions["A"].width = 28
        summary.column_dimensions["B"].width = 20
        for row_number in range(4, 4 + len(rows)):
            label = summary.cell(row=row_number, column=1).value
            if label in {"Total revenue", "Total cost", "Gross profit", "Average order", "Median order"}:
                summary.cell(row=row_number, column=2).number_format = '$#,##0.00'
            if label in {"Gross margin", "Repeat customer rate", "Top customer share", "Top product share", "Latest revenue growth", "Latest profit growth"}:
                summary.cell(row=row_number, column=2).number_format = "0.0%"

        for sheet_name in workbook.sheetnames:
            if sheet_name != "Executive Summary":
                _style_table_sheet(workbook[sheet_name])

        monthly_sheet = workbook["Monthly"]
        if len(summaries["monthly"]):
            chart = LineChart()
            chart.title = "Monthly Revenue and Profit"
            chart.y_axis.title = "Amount"
            chart.x_axis.title = "Month"
            chart.add_data(Reference(monthly_sheet, min_col=2, max_col=4, min_row=1, max_row=len(summaries["monthly"]) + 1), titles_from_data=True)
            chart.set_categories(Reference(monthly_sheet, min_col=1, min_row=2, max_row=len(summaries["monthly"]) + 1))
            summary.add_chart(chart, "D3")

        product_sheet = workbook["Products"]
        count = min(len(summaries["products"]), 10)
        if count:
            chart = BarChart()
            chart.title = "Top Products by Revenue"
            chart.add_data(Reference(product_sheet, min_col=2, min_row=1, max_row=count + 1), titles_from_data=True)
            chart.set_categories(Reference(product_sheet, min_col=1, min_row=2, max_row=count + 1))
            summary.add_chart(chart, "D20")

    return output.getvalue()
