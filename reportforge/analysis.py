from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import BinaryIO

import pandas as pd

from reportforge.exceptions import InvalidDataError, UnsupportedFileError
from reportforge.models import ColumnMapping, SalesMetrics


MAX_ROWS = 500_000
NULL_TOKENS = {"", "-", "—", "n/a", "na", "none", "null", "unknown"}


def _deduplicate_headers(columns: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    result: list[str] = []
    for index, column in enumerate(columns, start=1):
        clean = re.sub(r"\s+", " ", str(column).strip()) or f"column_{index}"
        count = counts.get(clean, 0)
        counts[clean] = count + 1
        result.append(clean if count == 0 else f"{clean}_{count + 1}")
    return result


def _detect_header_row(preview: pd.DataFrame) -> int:
    """Choose the row most likely to contain headers within the first 15 rows."""
    best_index = 0
    best_score = float("-inf")
    for index, row in preview.head(15).iterrows():
        values = [str(value).strip() for value in row.tolist() if pd.notna(value)]
        if not values:
            continue
        text_cells = sum(bool(re.search(r"[A-Za-z]", value)) for value in values)
        unique_ratio = len(set(values)) / max(len(values), 1)
        unnamed_penalty = sum(value.lower().startswith("unnamed") for value in values)
        score = text_cells * 2 + unique_ratio - unnamed_penalty * 2
        if score > best_score:
            best_index = int(index)
            best_score = score
    return best_index


def _read_csv_resilient(raw_bytes: bytes) -> pd.DataFrame:
    encodings = ("utf-8-sig", "utf-8", "cp1252", "latin-1")
    last_error: Exception | None = None

    for encoding in encodings:
        try:
            text = raw_bytes.decode(encoding)
            sample = text[:8192]
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                delimiter = dialect.delimiter
            except csv.Error:
                delimiter = ","

            preview = pd.read_csv(
                io.StringIO(text),
                sep=delimiter,
                header=None,
                nrows=15,
                engine="python",
                on_bad_lines="skip",
            )
            header_row = _detect_header_row(preview)
            return pd.read_csv(
                io.StringIO(text),
                sep=delimiter,
                header=header_row,
                engine="python",
                on_bad_lines="skip",
            )
        except Exception as exc:
            last_error = exc

    raise InvalidDataError("The CSV encoding or structure could not be detected.") from last_error


def _read_excel_resilient(raw_bytes: bytes) -> pd.DataFrame:
    buffer = io.BytesIO(raw_bytes)
    preview = pd.read_excel(buffer, header=None, nrows=15, engine="openpyxl")
    header_row = _detect_header_row(preview)
    buffer.seek(0)
    return pd.read_excel(buffer, header=header_row, engine="openpyxl")


def read_tabular_file(file: BinaryIO, filename: str) -> pd.DataFrame:
    """Read messy CSV/XLSX uploads using delimiter, encoding, and header detection."""
    suffix = Path(filename).suffix.lower()
    raw_bytes = file.read()
    if not raw_bytes:
        raise InvalidDataError("The uploaded file is empty.")

    try:
        if suffix == ".csv":
            dataframe = _read_csv_resilient(raw_bytes)
        elif suffix == ".xlsx":
            dataframe = _read_excel_resilient(raw_bytes)
        else:
            raise UnsupportedFileError("Please upload a .csv or .xlsx file.")
    except (UnsupportedFileError, InvalidDataError):
        raise
    except Exception as exc:
        raise InvalidDataError(
            "The file could not be read. Confirm that it is a valid CSV or XLSX file."
        ) from exc

    dataframe = dataframe.dropna(how="all").dropna(axis=1, how="all")
    if dataframe.empty:
        raise InvalidDataError("The uploaded file contains no usable data.")
    if len(dataframe) > MAX_ROWS:
        raise InvalidDataError(
            f"The file contains {len(dataframe):,} rows. The current limit is {MAX_ROWS:,}."
        )

    dataframe.columns = _deduplicate_headers(list(dataframe.columns))
    return dataframe.reset_index(drop=True)


def _currency_to_number(series: pd.Series) -> pd.Series:
    cleaned = (
        series.astype("string")
        .str.strip()
        .str.lower()
        .replace(list(NULL_TOKENS), pd.NA)
        .str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        .str.replace(r"[$£€¥,%]", "", regex=True)
        .str.replace(r"\s", "", regex=True)
        .str.replace(",", "", regex=False)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def _normalize_text(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.replace(r"[\r\n\t]+", " ", regex=True)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
        .replace(list(NULL_TOKENS), pd.NA)
    )


def prepare_sales_data(
    raw: pd.DataFrame,
    mapping: ColumnMapping,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    selected = {
        "date": mapping.date,
        "customer": mapping.customer,
        "product": mapping.product,
        "revenue": mapping.revenue,
    }
    if mapping.cost:
        selected["cost"] = mapping.cost

    missing_columns = [source for source in selected.values() if source not in raw.columns]
    if missing_columns:
        raise InvalidDataError(f"Mapped columns are missing: {', '.join(missing_columns)}.")

    data = raw[list(selected.values())].rename(
        columns={source: target for target, source in selected.items()}
    )
    data["_source_row"] = data.index + 2
    if "cost" not in data:
        data["cost"] = 0.0

    data["date"] = pd.to_datetime(data["date"], errors="coerce", format="mixed")
    data["revenue"] = _currency_to_number(data["revenue"])
    data["cost"] = _currency_to_number(data["cost"]).fillna(0.0)
    data["customer"] = _normalize_text(data["customer"])
    data["product"] = _normalize_text(data["product"])

    issues = pd.Series("", index=data.index, dtype="string")

    def add_issue(mask: pd.Series, message: str) -> None:
        nonlocal issues
        issues.loc[mask] = issues.loc[mask].apply(
            lambda current: f"{current}; {message}".strip("; ")
        )

    add_issue(data["date"].isna(), "Invalid or missing date")
    add_issue(data["revenue"].isna(), "Invalid or missing revenue")
    add_issue(data["customer"].isna(), "Missing customer")
    add_issue(data["product"].isna(), "Missing product")
    add_issue(data["revenue"].lt(0), "Negative revenue")
    add_issue(data["cost"].lt(0), "Negative cost")

    duplicate_mask = data.duplicated(
        subset=["date", "customer", "product", "revenue", "cost"], keep="first"
    )
    add_issue(duplicate_mask, "Duplicate transaction")

    rejected = data.loc[issues.ne("")].copy()
    rejected["issue"] = issues.loc[issues.ne("")]
    valid = data.loc[issues.eq("")].copy()

    if valid.empty:
        raise InvalidDataError("No valid transactions remain after validation.")

    valid["profit"] = valid["revenue"] - valid["cost"]
    valid["margin"] = valid["profit"].div(valid["revenue"].where(valid["revenue"].ne(0)))
    valid["month"] = valid["date"].dt.to_period("M").astype(str)
    valid["weekday"] = valid["date"].dt.day_name()
    valid["year"] = valid["date"].dt.year

    q1 = valid["revenue"].quantile(0.25)
    q3 = valid["revenue"].quantile(0.75)
    iqr = q3 - q1
    if iqr > 0:
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        valid["is_anomaly"] = ~valid["revenue"].between(lower, upper)
    else:
        valid["is_anomaly"] = False

    return valid.sort_values("date").reset_index(drop=True), rejected.reset_index(drop=True)


def _growth_rate(current: float, previous: float) -> float | None:
    """
    Calculate percentage growth between two periods.

    Returns None when the previous value is zero because percentage
    growth would be undefined.
    """
    if previous == 0:
        return None

    return (current - previous) / abs(previous)


def calculate_metrics(data: pd.DataFrame) -> SalesMetrics:
    """
    Calculate executive sales metrics from cleaned transaction data.

    The input DataFrame is expected to contain:
    - date
    - month
    - customer
    - product
    - revenue
    - cost
    - profit

    The is_anomaly column is optional.
    """
    if data.empty:
        raise InvalidDataError("No valid data is available for analysis.")

    required_columns = {
        "month",
        "customer",
        "product",
        "revenue",
        "cost",
        "profit",
    }

    missing_columns = required_columns.difference(data.columns)

    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise InvalidDataError(
            f"Metrics cannot be calculated because these fields are missing: {missing}."
        )

    total_revenue = float(data["revenue"].sum())
    total_cost = float(data["cost"].sum())
    gross_profit = float(data["profit"].sum())
    transaction_count = int(len(data))

    gross_margin = (
        gross_profit / total_revenue
        if total_revenue != 0
        else None
    )

    average_order_value = (
        total_revenue / transaction_count
        if transaction_count > 0
        else 0.0
    )

    median_order_value = float(data["revenue"].median())

    unique_customers = int(data["customer"].nunique())
    unique_products = int(data["product"].nunique())

    customer_order_counts = data.groupby("customer").size()

    repeat_customer_rate = (
        float(customer_order_counts.gt(1).mean())
        if not customer_order_counts.empty
        else 0.0
    )

    customer_revenue = (
        data.groupby("customer")["revenue"]
        .sum()
        .sort_values(ascending=False)
    )

    product_revenue = (
        data.groupby("product")["revenue"]
        .sum()
        .sort_values(ascending=False)
    )

    top_customer_share = (
        float(customer_revenue.iloc[0] / total_revenue)
        if total_revenue != 0 and not customer_revenue.empty
        else 0.0
    )

    top_product_share = (
        float(product_revenue.iloc[0] / total_revenue)
        if total_revenue != 0 and not product_revenue.empty
        else 0.0
    )

    monthly = (
        data.groupby("month", as_index=False)
        .agg(
            revenue=("revenue", "sum"),
            profit=("profit", "sum"),
        )
        .sort_values("month")
        .reset_index(drop=True)
    )

    revenue_growth: float | None = None
    profit_growth: float | None = None

    if len(monthly) >= 2:
        current_month = monthly.iloc[-1]
        previous_month = monthly.iloc[-2]

        revenue_growth = _growth_rate(
            current=float(current_month["revenue"]),
            previous=float(previous_month["revenue"]),
        )

        profit_growth = _growth_rate(
            current=float(current_month["profit"]),
            previous=float(previous_month["profit"]),
        )

    if "is_anomaly" in data.columns:
        anomaly_count = int(
            data["is_anomaly"]
            .fillna(False)
            .astype(bool)
            .sum()
        )
    else:
        anomaly_count = 0

    return SalesMetrics(
        total_revenue=total_revenue,
        total_cost=total_cost,
        gross_profit=gross_profit,
        gross_margin=gross_margin,
        transaction_count=transaction_count,
        average_order_value=average_order_value,
        median_order_value=median_order_value,
        unique_customers=unique_customers,
        unique_products=unique_products,
        repeat_customer_rate=repeat_customer_rate,
        top_customer_share=top_customer_share,
        top_product_share=top_product_share,
        revenue_growth=revenue_growth,
        profit_growth=profit_growth,
        anomaly_count=anomaly_count,
    )
    total_revenue = float(data["revenue"].sum())
    total_cost = float(data["cost"].sum())
    gross_profit = total_revenue - total_cost
    transaction_count = len(data)

    customer_revenue = data.groupby("customer")["revenue"].sum().sort_values(ascending=False)
    product_revenue = data.groupby("product")["revenue"].sum().sort_values(ascending=False)
    customer_orders = data.groupby("customer").size()

    monthly = data.groupby("month").agg(revenue=("revenue", "sum"), profit=("profit", "sum"))
    revenue_growth = profit_growth = None
    if len(monthly) >= 2:
        revenue_growth = _growth_rate(float(monthly.iloc[-1]["revenue"]), float(monthly.iloc[-2]["revenue"]))
        profit_growth = _growth_rate(float(monthly.iloc[-1]["profit"]), float(monthly.iloc[-2]["profit"]))

    return SalesMetrics(
        total_revenue=total_revenue,
        total_cost=total_cost,
        gross_profit=gross_profit,
        gross_margin=(gross_profit / total_revenue if total_revenue else None),
        transaction_count=int(transaction_count),
        average_order_value=(total_revenue / transaction_count if transaction_count else 0.0),
        median_order_value=float(data["revenue"].median()),
        unique_customers=int(data["customer"].nunique()),
        unique_products=int(data["product"].nunique()),
        repeat_customer_rate=float(customer_orders.gt(1).mean()),
        top_customer_share=(float(customer_revenue.iloc[0] / total_revenue) if total_revenue else 0.0),
        top_product_share=(float(product_revenue.iloc[0] / total_revenue) if total_revenue else 0.0),
        revenue_growth=revenue_growth,
        profit_growth=profit_growth,
        anomaly_count=int(data["is_anomaly"].sum()),
    )


def build_summary_tables(data: pd.DataFrame) -> dict[str, pd.DataFrame]:
    monthly = (
        data.groupby("month", as_index=False)
        .agg(
            revenue=("revenue", "sum"),
            cost=("cost", "sum"),
            profit=("profit", "sum"),
            transactions=("revenue", "size"),
            average_order=("revenue", "mean"),
        )
        .sort_values("month")
    )
    monthly["revenue_growth"] = monthly["revenue"].pct_change()
    monthly["profit_margin"] = monthly["profit"].div(monthly["revenue"].where(monthly["revenue"].ne(0)))

    products = (
        data.groupby("product", as_index=False)
        .agg(
            revenue=("revenue", "sum"), cost=("cost", "sum"), profit=("profit", "sum"),
            transactions=("revenue", "size"), average_order=("revenue", "mean")
        )
        .sort_values("revenue", ascending=False)
    )
    products["margin"] = products["profit"].div(products["revenue"].where(products["revenue"].ne(0)))
    products["revenue_share"] = products["revenue"] / products["revenue"].sum()

    customers = (
        data.groupby("customer", as_index=False)
        .agg(
            revenue=("revenue", "sum"), profit=("profit", "sum"), transactions=("revenue", "size"),
            average_order=("revenue", "mean"), first_purchase=("date", "min"), last_purchase=("date", "max")
        )
        .sort_values("revenue", ascending=False)
    )
    customers["revenue_share"] = customers["revenue"] / customers["revenue"].sum()

    weekday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekdays = data.groupby("weekday", as_index=False).agg(revenue=("revenue", "sum"), transactions=("revenue", "size"))
    weekdays["weekday"] = pd.Categorical(weekdays["weekday"], categories=weekday_order, ordered=True)
    weekdays = weekdays.sort_values("weekday")

    anomalies = data.loc[data["is_anomaly"]].sort_values("revenue", ascending=False)

    return {
        "monthly": monthly,
        "products": products,
        "customers": customers,
        "weekdays": weekdays,
        "anomalies": anomalies,
    }
