import io

import pandas as pd
import pytest

from reportforge.analysis import build_summary_tables, calculate_metrics, prepare_sales_data, read_tabular_file
from reportforge.models import ColumnMapping


@pytest.fixture
def mapping() -> ColumnMapping:
    return ColumnMapping("Sale Date", "Client", "Service", "Amount", "Expense")


def test_resilient_csv_reader_detects_header_and_separator() -> None:
    content = "Title row;;;;\nGenerated;;;;\nSale Date;Client;Service;Amount;Expense\n2026-01-01;Acme;Audit;$1,000.00;400\n"
    dataframe = read_tabular_file(io.BytesIO(content.encode()), "sales.csv")
    assert list(dataframe.columns) == ["Sale Date", "Client", "Service", "Amount", "Expense"]
    assert len(dataframe) == 1


def test_prepare_sales_data_rejects_invalid_rows(mapping: ColumnMapping) -> None:
    raw = pd.DataFrame({"Sale Date": ["2026-01-01", "bad", "2026-01-03"], "Client": ["Acme", "Beta", "Gamma"], "Service": ["Audit", "Setup", "Support"], "Amount": ["$1,000", "500", "-10"], "Expense": ["400", "100", "5"]})
    clean, rejected = prepare_sales_data(raw, mapping)
    assert len(clean) == 1
    assert clean.iloc[0]["revenue"] == pytest.approx(1000)
    assert len(rejected) == 2


def test_advanced_metrics_and_summaries(mapping: ColumnMapping) -> None:
    raw = pd.DataFrame({"Sale Date": ["2026-01-01", "2026-01-15", "2026-02-01"], "Client": ["Acme", "Acme", "Beta"], "Service": ["Audit", "Support", "Audit"], "Amount": [1000, 500, 800], "Expense": [400, 100, 300]})
    clean, _ = prepare_sales_data(raw, mapping)
    metrics = calculate_metrics(clean)
    summaries = build_summary_tables(clean)
    assert metrics.total_revenue == pytest.approx(2300)
    assert metrics.repeat_customer_rate == pytest.approx(0.5)
    assert "revenue_growth" in summaries["monthly"].columns
    assert "weekdays" in summaries
