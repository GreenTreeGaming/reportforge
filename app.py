from __future__ import annotations

import hashlib
import html
from dataclasses import replace
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from reportforge.advanced_analytics import build_advanced_analytics
from reportforge.analysis import (
    build_summary_tables,
    calculate_metrics,
    prepare_sales_data,
    read_tabular_file,
)
from reportforge.exceptions import ReportForgeError
from reportforge.models import ColumnMapping
from reportforge.reporting import create_excel_report
from reportforge.ui import (
    inject_styles,
    render_brand,
    render_brief,
    render_empty,
    render_file_chips,
    render_insight,
    render_kpis,
    render_note,
    render_page_header,
    render_section_header,
)


st.set_page_config(
    page_title="ReportForge",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_styles()

VIEW_OPTIONS = (
    "Overview",
    "Customers",
    "Products",
    "Data quality",
    "Export",
)

COMPARISON_WINDOWS = {
    "30 days": 30,
    "60 days": 60,
    "90 days": 90,
}

PRIORITY_LABELS = {
    "critical": "Critical",
    "high": "High",
    "medium": "Watch",
    "opportunity": "Opportunity",
    "info": "Info",
}


# -----------------------------------------------------------------------------
# Formatting and state helpers
# -----------------------------------------------------------------------------


def money(value: Any, *, compact: bool = False) -> str:
    if value is None or pd.isna(value):
        return "—"
    number = float(value)
    if compact:
        magnitude = abs(number)
        if magnitude >= 1_000_000_000:
            return f"${number / 1_000_000_000:.1f}B"
        if magnitude >= 1_000_000:
            return f"${number / 1_000_000:.1f}M"
        if magnitude >= 1_000:
            return f"${number / 1_000:.1f}K"
    return f"${number:,.2f}"


def pct(value: Any, *, signed: bool = False) -> str:
    if value is None or pd.isna(value):
        return "—"
    prefix = "+" if signed and float(value) > 0 else ""
    return f"{prefix}{float(value):.1%}"


def integer(value: Any) -> str:
    if value is None or pd.isna(value):
        return "—"
    return f"{int(value):,}"


def safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def fingerprint(file_bytes: bytes, filename: str) -> str:
    digest = hashlib.sha256(file_bytes).hexdigest()
    return f"{filename}:{digest}"


def normalized_column(column: str) -> str:
    return (
        column.lower()
        .replace("_", " ")
        .replace("-", " ")
        .replace("/", " ")
    )


def guess_index(
    columns: list[str],
    keywords: tuple[str, ...],
    fallback: int,
) -> int:
    for index, column in enumerate(columns):
        if any(keyword in normalized_column(column) for keyword in keywords):
            return index
    return min(fallback, len(columns) - 1)


def find_index(columns: list[str], keywords: tuple[str, ...]) -> int | None:
    for index, column in enumerate(columns):
        if any(keyword in normalized_column(column) for keyword in keywords):
            return index
    return None


def reset_workspace() -> None:
    for key in (
        "active_file_key",
        "analysis_result",
        "analysis_mapping",
        "demo_file_bytes",
        "demo_file_name",
    ):
        st.session_state.pop(key, None)
    st.session_state["uploader_version"] = st.session_state.get("uploader_version", 0) + 1


@st.cache_data(show_spinner=False)
def load_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    return read_tabular_file(BytesIO(file_bytes), filename)


@st.cache_data(show_spinner=False)
def analyze_view(
    data: pd.DataFrame,
    comparison_days: int,
) -> tuple[Any, dict[str, pd.DataFrame], dict[str, object]]:
    metrics = calculate_metrics(data)
    summaries = build_summary_tables(data)
    advanced = build_advanced_analytics(
        data,
        comparison_days=comparison_days,
    )
    return metrics, summaries, advanced


def build_report(
    clean_data: pd.DataFrame,
    rejected_data: pd.DataFrame,
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
    cost_available: bool,
) -> bytes:
    return create_excel_report(
        clean_data,
        rejected_data,
        metrics,
        summaries,
        advanced=advanced,
        cost_available=cost_available,
    )


# -----------------------------------------------------------------------------
# Chart helpers
# -----------------------------------------------------------------------------


def style_chart(
    figure: go.Figure,
    *,
    height: int = 380,
    show_legend: bool = True,
) -> go.Figure:
    figure.update_layout(
        template="plotly_white",
        height=height,
        margin=dict(l=22, r=22, t=52, b=24),
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font=dict(
            family=(
                "Avenir Next, Avenir, Segoe UI Variable, Segoe UI, "
                "Helvetica Neue, Arial, sans-serif"
            ),
            color="#181817",
            size=12,
        ),
        title=dict(
            x=0.02,
            xanchor="left",
            font=dict(size=15, color="#181817"),
        ),
        showlegend=show_legend,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(size=11, color="#6b6b66"),
        ),
        hoverlabel=dict(
            bgcolor="#ffffff",
            bordercolor="#e5e5df",
            font_size=12,
            font_color="#181817",
        ),
    )
    figure.update_xaxes(
        showgrid=False,
        zeroline=False,
        linecolor="#e5e5df",
        tickfont=dict(color="#6b6b66"),
        title_font=dict(color="#6b6b66"),
    )
    figure.update_yaxes(
        gridcolor="#eeeeea",
        zeroline=False,
        linecolor="#e5e5df",
        tickfont=dict(color="#6b6b66"),
        title_font=dict(color="#6b6b66"),
    )
    return figure


def revenue_trend_chart(monthly: pd.DataFrame, cost_available: bool) -> go.Figure:
    figure = go.Figure()
    figure.add_trace(
        go.Scatter(
            x=monthly["month"],
            y=monthly["revenue"],
            name="Revenue",
            mode="lines+markers",
            line=dict(color="#2457e6", width=2.5),
            marker=dict(size=6),
            hovertemplate="%{x}<br>Revenue: $%{y:,.2f}<extra></extra>",
        )
    )
    if cost_available and "profit" in monthly.columns:
        figure.add_trace(
            go.Scatter(
                x=monthly["month"],
                y=monthly["profit"],
                name="Gross profit",
                mode="lines+markers",
                line=dict(color="#147a5b", width=2.2),
                marker=dict(size=5),
                hovertemplate="%{x}<br>Gross profit: $%{y:,.2f}<extra></extra>",
            )
        )
    figure.update_layout(title="Revenue over time", hovermode="x unified")
    return style_chart(figure)


def revenue_bridge_chart(
    bridge: pd.DataFrame,
    period_window: Any,
) -> go.Figure:
    measure = [
        "absolute" if kind == "total" else "relative"
        for kind in bridge["kind"]
    ]
    figure = go.Figure(
        go.Waterfall(
            x=bridge["component"],
            y=bridge["value"],
            measure=measure,
            increasing=dict(marker=dict(color="#147a5b")),
            decreasing=dict(marker=dict(color="#b42318")),
            totals=dict(marker=dict(color="#2457e6")),
            connector=dict(line=dict(color="#d2d2ca")),
            hovertemplate="%{x}<br>$%{y:,.2f}<extra></extra>",
        )
    )
    figure.update_layout(
        title=(
            f"What changed in the latest {period_window.days} days"
        ),
        showlegend=False,
    )
    return style_chart(figure, show_legend=False)


def horizontal_bar(
    data: pd.DataFrame,
    *,
    category: str,
    value: str,
    title: str,
    top_n: int,
    value_label: str,
) -> go.Figure:
    subset = data.head(top_n).sort_values(value).copy()
    figure = px.bar(
        subset,
        x=value,
        y=category,
        orientation="h",
        title=title,
    )
    figure.update_traces(
        marker_color="#2457e6",
        hovertemplate=f"%{{y}}<br>{value_label}: $%{{x:,.2f}}<extra></extra>",
    )
    return style_chart(figure, show_legend=False)


# -----------------------------------------------------------------------------
# Source and mapping flow
# -----------------------------------------------------------------------------


def get_source() -> tuple[bytes, str] | None:
    uploader_key = f"source_file_{st.session_state.get('uploader_version', 0)}"
    uploaded_file = st.file_uploader(
        "Upload a sales file",
        type=["csv", "xlsx"],
        key=uploader_key,
        label_visibility="collapsed",
        help="CSV and XLSX files are supported.",
    )

    sample_path = Path("sample_data/sample_sales.csv")
    if sample_path.exists():
        if st.button(
            "Use the sample dataset",
            type="secondary",
            use_container_width=True,
        ):
            st.session_state["demo_file_bytes"] = sample_path.read_bytes()
            st.session_state["demo_file_name"] = sample_path.name
            st.rerun()

    if uploaded_file is not None:
        st.session_state.pop("demo_file_bytes", None)
        st.session_state.pop("demo_file_name", None)
        return uploaded_file.getvalue(), uploaded_file.name

    demo_bytes = st.session_state.get("demo_file_bytes")
    demo_name = st.session_state.get("demo_file_name")
    if demo_bytes and demo_name:
        return demo_bytes, demo_name
    return None


def render_onboarding() -> None:
    render_brand(meta="CSV and Excel")
    left, right = st.columns([1.15, 0.85], gap="large")

    with left:
        render_page_header(
            "A business report you can understand at a glance.",
            (
                "Upload a sales spreadsheet. ReportForge cleans it, explains what changed, "
                "surfaces the few issues that matter, and creates a report you can share."
            ),
            eyebrow="Sales reporting",
        )
        render_section_header("What the report answers")
        answer_one, answer_two, answer_three = st.columns(3, gap="small")
        with answer_one:
            render_note("How revenue and profit are changing—not just the totals.")
        with answer_two:
            render_note("Which customers or products need attention now.")
        with answer_three:
            render_note("What action to take, with the rows behind every finding.")

    with right:
        with st.container(border=True):
            st.markdown("#### Add your spreadsheet")
            st.caption("Your file is processed in the current Streamlit session.")
            source = get_source()
            if source is None:
                st.caption("Required: date, customer, product or service, and revenue.")
                return

    if source is not None:
        render_mapping(source)


def render_mapping(source: tuple[bytes, str]) -> None:
    file_bytes, filename = source
    current_key = fingerprint(file_bytes, filename)
    if st.session_state.get("active_file_key") != current_key:
        st.session_state["active_file_key"] = current_key
        st.session_state.pop("analysis_result", None)
        st.session_state.pop("analysis_mapping", None)

    try:
        with st.spinner("Reading the spreadsheet..."):
            raw_data = load_file(file_bytes, filename)
    except ReportForgeError as exc:
        st.error(str(exc))
        return
    except Exception as exc:
        st.error("The spreadsheet could not be imported.")
        with st.expander("Technical details"):
            st.exception(exc)
        return

    render_section_header(
        "Confirm the columns",
        "ReportForge guessed the business fields. Review them once before the report is built.",
    )
    render_file_chips(
        [
            filename,
            f"{len(raw_data):,} rows",
            f"{len(raw_data.columns):,} columns",
            f"{int(raw_data.isna().sum().sum()):,} missing cells",
        ]
    )

    with st.expander("Preview the source data"):
        st.dataframe(
            raw_data.head(20),
            use_container_width=True,
            hide_index=True,
            height=300,
        )

    columns = [str(column) for column in raw_data.columns]
    with st.form("column_mapping", border=True):
        first_row = st.columns(2, gap="large")
        with first_row[0]:
            date_column = st.selectbox(
                "Date",
                columns,
                index=guess_index(columns, ("date", "time", "day"), 0),
                help="The transaction, invoice, or order date.",
            )
        with first_row[1]:
            customer_column = st.selectbox(
                "Customer",
                columns,
                index=guess_index(
                    columns,
                    ("customer", "client", "account", "buyer"),
                    min(1, len(columns) - 1),
                ),
                help="The customer, account, or client name.",
            )

        second_row = st.columns(2, gap="large")
        with second_row[0]:
            product_column = st.selectbox(
                "Product or service",
                columns,
                index=guess_index(
                    columns,
                    ("product", "service", "item", "sku"),
                    min(2, len(columns) - 1),
                ),
            )
        with second_row[1]:
            revenue_column = st.selectbox(
                "Revenue",
                columns,
                index=guess_index(
                    columns,
                    ("revenue", "sales", "amount", "total", "price"),
                    min(3, len(columns) - 1),
                ),
            )

        cost_match = find_index(columns, ("cost", "expense", "cogs"))
        cost_options = ["No cost column", *columns]
        cost_column = st.selectbox(
            "Cost (optional)",
            cost_options,
            index=0 if cost_match is None else cost_match + 1,
            help="Without cost, ReportForge hides profit and margin conclusions.",
        )

        submitted = st.form_submit_button(
            "Build the report",
            type="primary",
            use_container_width=True,
        )

    if not submitted:
        return

    required = [date_column, customer_column, product_column, revenue_column]
    if len(set(required)) != len(required):
        st.error("Date, customer, product, and revenue must use different columns.")
        return

    mapping = ColumnMapping(
        date=date_column,
        customer=customer_column,
        product=product_column,
        revenue=revenue_column,
        cost=None if cost_column == "No cost column" else cost_column,
    )

    try:
        with st.spinner("Cleaning the data and building the report..."):
            clean_data, rejected_data = prepare_sales_data(raw_data, mapping)
    except ReportForgeError as exc:
        st.error(str(exc))
        return
    except Exception as exc:
        st.error("An unexpected error occurred while preparing the report.")
        with st.expander("Technical details"):
            st.exception(exc)
        return

    st.session_state["analysis_mapping"] = {
        "date": mapping.date,
        "customer": mapping.customer,
        "product": mapping.product,
        "revenue": mapping.revenue,
        "cost": mapping.cost,
    }
    st.session_state["analysis_result"] = {
        "filename": filename,
        "raw_rows": len(raw_data),
        "raw_columns": len(raw_data.columns),
        "missing_cells": int(raw_data.isna().sum().sum()),
        "duplicate_rows": int(raw_data.duplicated().sum()),
        "clean_data": clean_data,
        "rejected_data": rejected_data,
        "cost_available": mapping.cost is not None,
    }
    st.rerun()


# -----------------------------------------------------------------------------
# Workspace helpers
# -----------------------------------------------------------------------------


def sidebar_controls(result: dict[str, Any]) -> dict[str, Any]:
    clean_data = result["clean_data"]
    min_date = clean_data["date"].min().date()
    max_date = clean_data["date"].max().date()

    with st.sidebar:
        st.markdown("### ReportForge")
        st.caption(result["filename"])
        st.divider()

        view = st.radio(
            "Workspace",
            VIEW_OPTIONS,
            label_visibility="collapsed",
        )

        st.divider()
        st.markdown("#### Report range")
        selected_dates = st.date_input(
            "Date range",
            value=(min_date, max_date),
            min_value=min_date,
            max_value=max_date,
        )
        comparison_label = st.selectbox(
            "Comparison window",
            list(COMPARISON_WINDOWS),
            index=0,
            help="Used for revenue movement, customer movement, and product momentum.",
        )

        with st.expander("Filters"):
            customer_query = st.text_input(
                "Customer contains",
                placeholder="Example: Acme",
            )
            product_query = st.text_input(
                "Product contains",
                placeholder="Example: Support",
            )

        with st.expander("Display"):
            top_n = st.slider("Rows in rankings", 5, 25, 10)
            show_definitions = st.toggle("Show metric definitions", value=False)

        st.divider()
        if st.button("Replace dataset", type="secondary", use_container_width=True):
            reset_workspace()
            st.rerun()

    if isinstance(selected_dates, (tuple, list)) and len(selected_dates) == 2:
        start_date, end_date = selected_dates
    else:
        start_date = end_date = selected_dates

    return {
        "view": view,
        "start_date": pd.Timestamp(start_date),
        "end_date": pd.Timestamp(end_date),
        "comparison_days": COMPARISON_WINDOWS[comparison_label],
        "customer_query": customer_query.strip(),
        "product_query": product_query.strip(),
        "top_n": top_n,
        "show_definitions": show_definitions,
    }


def filter_data(data: pd.DataFrame, controls: dict[str, Any]) -> pd.DataFrame:
    end_exclusive = controls["end_date"] + pd.Timedelta(days=1)
    filtered = data.loc[
        data["date"].ge(controls["start_date"])
        & data["date"].lt(end_exclusive)
    ].copy()

    customer_query = controls["customer_query"]
    if customer_query:
        filtered = filtered.loc[
            filtered["customer"].astype(str).str.contains(
                customer_query,
                case=False,
                na=False,
                regex=False,
            )
        ]

    product_query = controls["product_query"]
    if product_query:
        filtered = filtered.loc[
            filtered["product"].astype(str).str.contains(
                product_query,
                case=False,
                na=False,
                regex=False,
            )
        ]

    return filtered.reset_index(drop=True)


def workspace_meta(data: pd.DataFrame, controls: dict[str, Any]) -> str:
    return (
        f"{controls['start_date']:%b %d, %Y}–{controls['end_date']:%b %d, %Y}"
        f" · {len(data):,} transactions"
    )


def bridge_change(bridge: pd.DataFrame) -> tuple[float, float, float | None]:
    if bridge.empty:
        return 0.0, 0.0, None
    starting = float(bridge.iloc[0]["value"])
    ending = float(bridge.iloc[-1]["value"])
    return starting, ending, safe_divide(ending - starting, starting)


def at_risk_summary(cadence: pd.DataFrame) -> tuple[int, float]:
    if cadence.empty or "cadence_status" not in cadence.columns:
        return 0, 0.0
    overdue = cadence.loc[
        cadence["cadence_status"].isin(["Overdue", "Severely overdue"])
    ]
    return (
        len(overdue),
        float(overdue.get("estimated_revenue_at_risk", pd.Series(dtype=float)).sum()),
    )


def adjust_advanced_for_missing_cost(
    advanced: dict[str, object],
    *,
    cost_available: bool,
) -> dict[str, object]:
    """Remove profit conclusions when the uploaded file has no cost field."""
    if cost_available:
        return advanced

    adjusted = dict(advanced)
    resilience = advanced["resilience"]
    revenue_only_score = (
        float(resilience.concentration_score) * 0.40
        + float(resilience.repeatability_score) * 0.35
        + float(resilience.stability_score) * 0.25
    )
    adjusted["resilience"] = replace(
        resilience,
        score=round(revenue_only_score, 1),
        margin_consistency_score=None,
    )

    products = advanced["product_momentum"].copy()
    if not products.empty and "signal" in products.columns:
        products["signal"] = products["signal"].replace(
            {
                "Breakout": "Growing",
                "Margin leakage": "Monitor",
            }
        )
    adjusted["product_momentum"] = products

    queue = advanced["decision_queue"].copy()
    if not queue.empty and "insight_id" in queue.columns:
        queue = queue.loc[
            ~queue["insight_id"].isin(["margin-leakage", "breakout-products"])
        ].reset_index(drop=True)
    adjusted["decision_queue"] = queue
    return adjusted


def health_label(score: float) -> str:
    if score >= 75:
        return "Strong"
    if score >= 55:
        return "Stable"
    if score >= 35:
        return "Exposed"
    return "Fragile"


def render_workspace_header(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    title: str,
    description: str,
) -> None:
    render_brand(meta=workspace_meta(data, controls))
    render_page_header(title, description)
    render_file_chips(
        [
            result["filename"],
            f"{data['customer'].nunique():,} customers",
            f"{data['product'].nunique():,} products",
        ]
    )


# -----------------------------------------------------------------------------
# Overview
# -----------------------------------------------------------------------------


def render_overview(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
) -> None:
    render_workspace_header(
        result,
        data,
        controls,
        "Overview",
        "The main result, the few things that need attention, and the evidence behind them.",
    )

    bridge = advanced["revenue_bridge"]
    period_window = advanced["period_window"]
    decision_queue = advanced["decision_queue"]
    cadence = advanced["customer_cadence"]
    resilience = advanced["resilience"]
    starting, ending, change = bridge_change(bridge)
    risk_count, risk_value = at_risk_summary(cadence)
    cost_available = result["cost_available"]

    if change is None:
        headline = "The latest comparison does not have enough prior revenue for a percentage change."
    elif change > 0.01:
        headline = f"Revenue increased {abs(change):.1%} in the latest {period_window.days}-day window."
    elif change < -0.01:
        headline = f"Revenue decreased {abs(change):.1%} in the latest {period_window.days}-day window."
    else:
        headline = f"Revenue was broadly stable in the latest {period_window.days}-day window."

    top_context = (
        str(decision_queue.iloc[0]["summary"])
        if not decision_queue.empty
        else "No material exception was detected in the selected data."
    )
    render_brief("Executive brief", headline, top_context)

    change_tone = "neutral"
    if change is not None and change > 0:
        change_tone = "positive"
    elif change is not None and change < 0:
        change_tone = "negative"

    render_section_header("At a glance")
    render_kpis(
        [
            {
                "label": "Revenue",
                "value": money(metrics.total_revenue, compact=True),
                "helper": "Across the selected date range",
            },
            {
                "label": f"Latest {period_window.days}-day change",
                "value": pct(change, signed=True),
                "helper": f"{money(starting, compact=True)} to {money(ending, compact=True)}",
                "delta": "Up" if change and change > 0 else "Down" if change and change < 0 else "Flat",
                "tone": change_tone,
            },
            {
                "label": "Gross margin",
                "value": pct(metrics.gross_margin) if cost_available else "Not available",
                "helper": "Cost column mapped" if cost_available else "Add cost data to calculate profit",
            },
            {
                "label": "Customer revenue at risk",
                "value": money(risk_value, compact=True),
                "helper": f"{risk_count:,} customers late versus their usual cadence",
                "tone": "negative" if risk_value > 0 else "neutral",
            },
        ]
    )

    if controls["show_definitions"]:
        render_note(
            "Revenue is the sum of accepted transactions. Latest change compares two equal-length rolling periods. "
            "Revenue at risk uses each repeat customer's own historical purchase interval and median order value."
        )

    render_section_header(
        "What needs attention",
        "Ranked by estimated business impact and confidence. Open the explanation only when you need the methodology.",
    )
    if decision_queue.empty:
        render_empty("No material finding is available for this filtered view.")
    else:
        for row in decision_queue.head(3).itertuples(index=False):
            impact = (
                "Impact not quantified"
                if pd.isna(row.impact_amount)
                else f"Estimated impact {money(row.impact_amount, compact=True)}"
            )
            render_insight(
                priority=PRIORITY_LABELS.get(str(row.priority), str(row.priority)),
                title=str(row.title),
                summary=str(row.summary),
                action=str(row.recommended_action),
                meta=f"{impact} · {row.confidence:.0%} confidence",
            )
            with st.expander(f"Why this was flagged: {row.title}"):
                st.write(row.evidence)

    render_section_header("Performance")
    left, right = st.columns([1.05, 0.95], gap="large")
    monthly = summaries["monthly"]
    with left:
        if monthly.empty:
            render_empty("No monthly trend is available.")
        else:
            st.plotly_chart(
                revenue_trend_chart(monthly, cost_available),
                use_container_width=True,
                config={"displayModeBar": False},
            )
    with right:
        if bridge.empty:
            render_empty("No equal-period revenue comparison is available.")
        else:
            st.plotly_chart(
                revenue_bridge_chart(bridge, period_window),
                use_container_width=True,
                config={"displayModeBar": False},
            )

    render_section_header(
        "Business resilience",
        "A simple read on concentration, repeatability, and revenue stability.",
    )
    score_left, score_right = st.columns([0.42, 0.58], gap="large")
    with score_left:
        with st.container(border=True):
            st.markdown(f"### {health_label(resilience.score)}")
            st.caption("Revenue resilience")
            st.progress(min(max(float(resilience.score) / 100, 0.0), 1.0))
            st.markdown(f"**{resilience.score:.0f} / 100**")
            st.caption(f"Confidence in this score: {resilience.confidence:.0%}")
    with score_right:
        render_kpis(
            [
                {
                    "label": "Top five customer share",
                    "value": pct(resilience.top_five_customer_share),
                    "helper": "Lower means less concentration risk",
                },
                {
                    "label": "Effective customer base",
                    "value": f"{resilience.effective_customer_count:.1f}",
                    "helper": "Concentration-adjusted customer count",
                },
            ]
        )


# -----------------------------------------------------------------------------
# Customers
# -----------------------------------------------------------------------------


def render_customers(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
) -> None:
    render_workspace_header(
        result,
        data,
        controls,
        "Customers",
        "See who is growing, who is late, and where revenue is overly concentrated.",
    )

    rfm = advanced["rfm"].copy()
    cadence = advanced["customer_cadence"].copy()
    movement = advanced["customer_movement"].copy()
    customers = summaries["customers"].copy()
    resilience = advanced["resilience"]
    risk_count, risk_value = at_risk_summary(cadence)

    render_kpis(
        [
            {
                "label": "Customers",
                "value": integer(metrics.unique_customers),
                "helper": "In the selected range",
            },
            {
                "label": "Repeat customer rate",
                "value": pct(metrics.repeat_customer_rate),
                "helper": "Customers with more than one transaction",
            },
            {
                "label": "Late versus normal cadence",
                "value": integer(risk_count),
                "helper": money(risk_value, compact=True) + " expected order value at risk",
            },
            {
                "label": "Largest customer share",
                "value": pct(resilience.top_customer_share),
                "helper": "Share of revenue from one customer",
            },
        ]
    )

    render_section_header(
        "Customers to contact",
        "These accounts are late relative to their own normal buying pattern—not a generic inactivity rule.",
    )
    if cadence.empty:
        render_empty("At least three distinct purchase dates per customer are needed to learn buying cadence.")
    else:
        overdue = cadence.loc[
            cadence["cadence_status"].isin(["Overdue", "Severely overdue", "Due soon"])
        ].copy()
        if overdue.empty:
            render_empty("No repeat customer is currently late or due soon.")
        else:
            st.dataframe(
                overdue[
                    [
                        "customer",
                        "cadence_status",
                        "days_overdue",
                        "expected_next_purchase",
                        "estimated_revenue_at_risk",
                        "confidence",
                    ]
                ].head(controls["top_n"]),
                use_container_width=True,
                hide_index=True,
                column_config={
                    "customer": "Customer",
                    "cadence_status": "Status",
                    "days_overdue": st.column_config.NumberColumn("Days overdue", format="%d"),
                    "expected_next_purchase": st.column_config.DateColumn("Expected next purchase"),
                    "estimated_revenue_at_risk": st.column_config.NumberColumn(
                        "Expected order value",
                        format="$%.2f",
                    ),
                    "confidence": st.column_config.ProgressColumn(
                        "Confidence",
                        min_value=0,
                        max_value=1,
                        format="percent",
                    ),
                },
            )

    render_section_header("Customer health")
    if rfm.empty:
        render_empty("Customer health segmentation is not available.")
    else:
        segment_options = ["All segments", *sorted(rfm["segment"].dropna().unique())]
        selected_segment = st.selectbox("Show segment", segment_options)
        customer_health = rfm
        if selected_segment != "All segments":
            customer_health = rfm.loc[rfm["segment"].eq(selected_segment)]

        st.dataframe(
            customer_health[
                [
                    "customer",
                    "segment",
                    "recency_days",
                    "transactions",
                    "revenue",
                    "average_order",
                    "last_purchase",
                ]
            ],
            use_container_width=True,
            hide_index=True,
            column_config={
                "customer": "Customer",
                "segment": "Plain-language segment",
                "recency_days": st.column_config.NumberColumn("Days since purchase", format="%d"),
                "transactions": st.column_config.NumberColumn("Transactions", format="%d"),
                "revenue": st.column_config.NumberColumn("Revenue", format="$%.2f"),
                "average_order": st.column_config.NumberColumn("Average order", format="$%.2f"),
                "last_purchase": st.column_config.DateColumn("Last purchase"),
            },
        )

    render_section_header("Concentration and movement")
    left, right = st.columns(2, gap="large")
    with left:
        if customers.empty:
            render_empty("Customer revenue data is not available.")
        else:
            st.plotly_chart(
                horizontal_bar(
                    customers,
                    category="customer",
                    value="revenue",
                    title="Largest customers by revenue",
                    top_n=controls["top_n"],
                    value_label="Revenue",
                ),
                use_container_width=True,
                config={"displayModeBar": False},
            )
    with right:
        if movement.empty:
            render_empty("Customer movement is not available.")
        else:
            status_summary = (
                movement.groupby("status", as_index=False)
                .agg(customers=("customer", "nunique"), revenue_change=("revenue_delta", "sum"))
                .sort_values("revenue_change")
            )
            movement_chart = px.bar(
                status_summary,
                x="revenue_change",
                y="status",
                orientation="h",
                title="Customer movement in the latest comparison",
            )
            movement_chart.update_traces(
                marker_color="#2457e6",
                hovertemplate="%{y}<br>Revenue change: $%{x:,.2f}<extra></extra>",
            )
            st.plotly_chart(
                style_chart(movement_chart, show_legend=False),
                use_container_width=True,
                config={"displayModeBar": False},
            )

    with st.expander("View customer movement details"):
        st.dataframe(
            movement,
            use_container_width=True,
            hide_index=True,
        )


# -----------------------------------------------------------------------------
# Products
# -----------------------------------------------------------------------------


def render_products(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
) -> None:
    render_workspace_header(
        result,
        data,
        controls,
        "Products",
        "Find what is accelerating, what is weakening, and which customers have clear cross-sell whitespace.",
    )

    momentum = advanced["product_momentum"].copy()
    cross_sell = advanced["cross_sell"].copy()
    products = summaries["products"].copy()
    cost_available = result["cost_available"]

    signal_counts = momentum["signal"].value_counts() if not momentum.empty else pd.Series(dtype=int)
    opportunity_value = (
        float(cross_sell["estimated_opportunity"].sum())
        if not cross_sell.empty and "estimated_opportunity" in cross_sell
        else 0.0
    )

    render_kpis(
        [
            {
                "label": "Products or services",
                "value": integer(metrics.unique_products),
                "helper": "In the selected range",
            },
            {
                "label": "Breakout" if cost_available else "Growing",
                "value": integer(
                    signal_counts.get("Breakout", 0)
                    if cost_available
                    else signal_counts.get("Growing", 0)
                ),
                "helper": (
                    "Revenue up with stable or improving profit"
                    if cost_available
                    else "Revenue growth in the latest comparison"
                ),
            },
            {
                "label": "Declining",
                "value": integer(signal_counts.get("Declining", 0)),
                "helper": "Revenue down at least 20% in the comparison",
            },
            {
                "label": "Modeled cross-sell whitespace",
                "value": money(opportunity_value, compact=True),
                "helper": "Conservative estimate across detected opportunities",
            },
        ]
    )

    render_section_header("Product momentum")
    if momentum.empty:
        render_empty("Product momentum is not available for this view.")
    else:
        momentum_columns = [
            "product",
            "signal",
            "previous_revenue",
            "current_revenue",
            "revenue_delta",
            "revenue_growth",
        ]
        if cost_available:
            momentum_columns.extend(["current_profit", "current_margin", "margin_delta"])

        st.dataframe(
            momentum[momentum_columns],
            use_container_width=True,
            hide_index=True,
            column_config={
                "product": "Product or service",
                "signal": "What it means",
                "previous_revenue": st.column_config.NumberColumn("Previous revenue", format="$%.2f"),
                "current_revenue": st.column_config.NumberColumn("Current revenue", format="$%.2f"),
                "revenue_delta": st.column_config.NumberColumn("Revenue change", format="$%.2f"),
                "revenue_growth": st.column_config.NumberColumn("Growth", format="percent"),
                "current_profit": st.column_config.NumberColumn("Current profit", format="$%.2f"),
                "current_margin": st.column_config.NumberColumn("Current margin", format="percent"),
                "margin_delta": st.column_config.NumberColumn("Margin change", format="percent"),
            },
        )

    if not cost_available:
        render_note(
            "Profit and margin signals are hidden because no cost column was mapped. Revenue momentum remains available."
        )

    render_section_header(
        "Cross-sell whitespace",
        "Directional product relationships with customers who bought the source product but not the target product.",
    )
    if cross_sell.empty:
        render_empty("More overlapping customer-product history is needed to identify reliable cross-sell whitespace.")
    else:
        st.dataframe(
            cross_sell[
                [
                    "source_product",
                    "target_product",
                    "eligible_customers",
                    "confidence",
                    "lift",
                    "estimated_opportunity",
                    "eligible_customer_examples",
                ]
            ].head(controls["top_n"]),
            use_container_width=True,
            hide_index=True,
            column_config={
                "source_product": "Customers already buy",
                "target_product": "Offer next",
                "eligible_customers": st.column_config.NumberColumn("Eligible customers", format="%d"),
                "confidence": st.column_config.NumberColumn("Observed affinity", format="percent"),
                "lift": st.column_config.NumberColumn("Lift", format="%.2fx"),
                "estimated_opportunity": st.column_config.NumberColumn(
                    "Modeled opportunity",
                    format="$%.2f",
                ),
                "eligible_customer_examples": "Example customers",
            },
        )

    render_section_header("Revenue leaders")
    if products.empty:
        render_empty("Product revenue data is not available.")
    else:
        st.plotly_chart(
            horizontal_bar(
                products,
                category="product",
                value="revenue",
                title="Top products or services by revenue",
                top_n=controls["top_n"],
                value_label="Revenue",
            ),
            use_container_width=True,
            config={"displayModeBar": False},
        )


# -----------------------------------------------------------------------------
# Data quality
# -----------------------------------------------------------------------------


def render_data_quality(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
) -> None:
    render_workspace_header(
        result,
        data,
        controls,
        "Data quality",
        "Understand what was accepted, what was excluded, and which transactions deserve review.",
    )

    rejected = result["rejected_data"]
    anomalies = summaries["anomalies"]
    total_processed = len(result["clean_data"]) + len(rejected)
    acceptance_rate = safe_divide(len(result["clean_data"]), total_processed) or 0.0

    render_kpis(
        [
            {
                "label": "Rows accepted",
                "value": integer(len(result["clean_data"])),
                "helper": pct(acceptance_rate) + " of mapped rows",
            },
            {
                "label": "Rows excluded",
                "value": integer(len(rejected)),
                "helper": "Invalid, incomplete, negative, or duplicate transactions",
            },
            {
                "label": "Unusual transactions",
                "value": integer(len(anomalies)),
                "helper": "Revenue values outside the file's typical range",
            },
            {
                "label": "Source duplicates",
                "value": integer(result["duplicate_rows"]),
                "helper": "Exact duplicate rows before business-field validation",
            },
        ]
    )

    render_section_header("Why rows were excluded")
    if rejected.empty or "issue" not in rejected.columns:
        render_empty("No rows were excluded.")
    else:
        issue_counts = (
            rejected["issue"]
            .astype(str)
            .str.split("; ")
            .explode()
            .value_counts()
            .rename_axis("issue")
            .reset_index(name="rows")
        )
        issue_chart = px.bar(
            issue_counts.sort_values("rows"),
            x="rows",
            y="issue",
            orientation="h",
            title="Excluded rows by reason",
        )
        issue_chart.update_traces(
            marker_color="#b42318",
            hovertemplate="%{y}<br>Rows: %{x:,}<extra></extra>",
        )
        st.plotly_chart(
            style_chart(issue_chart, show_legend=False),
            use_container_width=True,
            config={"displayModeBar": False},
        )
        with st.expander("View excluded rows"):
            st.dataframe(rejected, use_container_width=True, hide_index=True)

    render_section_header("Transactions to review")
    if anomalies.empty:
        render_empty("No unusual revenue values were detected.")
    else:
        st.dataframe(
            anomalies,
            use_container_width=True,
            hide_index=True,
        )

    render_section_header("Accepted data")
    st.dataframe(
        data,
        use_container_width=True,
        hide_index=True,
        height=420,
    )


# -----------------------------------------------------------------------------
# Export
# -----------------------------------------------------------------------------


def render_export(
    result: dict[str, Any],
    data: pd.DataFrame,
    controls: dict[str, Any],
    metrics: Any,
    summaries: dict[str, pd.DataFrame],
    advanced: dict[str, object],
) -> None:
    render_workspace_header(
        result,
        data,
        controls,
        "Export",
        "Download a clean workbook that matches the filters and comparison window currently on screen.",
    )

    left, right = st.columns([0.62, 0.38], gap="large")
    with left:
        with st.container(border=True):
            st.markdown("### Business performance workbook")
            st.caption(
                "Includes the executive summary, decision queue, revenue bridge, customer health, "
                "purchase cadence, cross-sell, product momentum, clean data, and quality findings."
            )
            with st.spinner("Preparing the workbook..."):
                report_bytes = build_report(
                    data,
                    result["rejected_data"],
                    metrics,
                    summaries,
                    advanced,
                    result["cost_available"],
                )
            st.download_button(
                "Download Excel report",
                data=report_bytes,
                file_name="reportforge_business_report.xlsx",
                mime=(
                    "application/vnd.openxmlformats-officedocument."
                    "spreadsheetml.sheet"
                ),
                type="primary",
                use_container_width=True,
            )
    with right:
        render_kpis(
            [
                {
                    "label": "Transactions included",
                    "value": integer(len(data)),
                    "helper": "Accepted rows matching the current filters",
                },
                {
                    "label": "Date coverage",
                    "value": f"{data['date'].min():%b %d}–{data['date'].max():%b %d}",
                    "helper": f"Comparison window: {controls['comparison_days']} days",
                },
            ]
        )

    render_section_header("Before sharing")
    render_note(
        "Review customer names and transaction-level detail before distributing the workbook. "
        "ReportForge does not add authentication, retention controls, or a privacy policy to your deployment."
    )


# -----------------------------------------------------------------------------
# App entrypoint
# -----------------------------------------------------------------------------


def main() -> None:
    result = st.session_state.get("analysis_result")
    if result is None:
        render_onboarding()
        return

    controls = sidebar_controls(result)
    filtered_data = filter_data(result["clean_data"], controls)
    if filtered_data.empty:
        render_brand(meta="No matching rows")
        render_page_header(
            "No data matches these filters.",
            "Adjust the date range or clear the customer and product filters in the sidebar.",
        )
        return

    try:
        with st.spinner("Updating the report..."):
            metrics, summaries, advanced = analyze_view(
                filtered_data,
                controls["comparison_days"],
            )
            advanced = adjust_advanced_for_missing_cost(
                advanced,
                cost_available=result["cost_available"],
            )
    except Exception as exc:
        st.error("The filtered report could not be calculated.")
        with st.expander("Technical details"):
            st.exception(exc)
        return

    view = controls["view"]
    renderers = {
        "Overview": render_overview,
        "Customers": render_customers,
        "Products": render_products,
        "Data quality": render_data_quality,
        "Export": render_export,
    }
    renderers[view](
        result,
        filtered_data,
        controls,
        metrics,
        summaries,
        advanced,
    )


if __name__ == "__main__":
    main()
