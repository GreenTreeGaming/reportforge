from __future__ import annotations

import hashlib
import html
from io import BytesIO
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from textwrap import dedent

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


st.set_page_config(
    page_title="ReportForge",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

def render_html(markup: str) -> None:
    st.markdown(
        dedent(markup).strip(),
        unsafe_allow_html=True,
    )

CSS = dedent("""
<style>
:root {
  --bg: #f6f8fc;
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --surface-muted: #f1f5f9;

  --text: #0f172a;
  --text-secondary: #334155;
  --muted: #64748b;

  --line: #e2e8f0;
  --line-strong: #cbd5e1;

  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-soft: #eef2ff;

  --blue: #3b82f6;
  --cyan: #06b6d4;
  --green: #16a34a;
  --green-soft: #ecfdf3;
  --red: #dc2626;
  --red-soft: #fee2e2;

  --shadow-sm: 0 5px 18px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 12px 34px rgba(15, 23, 42, 0.07);
  --shadow-lg: 0 24px 70px rgba(37, 99, 235, 0.16);
}

/* ---------------------------------------------------------
   Global page
--------------------------------------------------------- */

html,
body,
[class*="css"] {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body {
  color: var(--text);
}

.stApp {
  color: var(--text);
  background:
    radial-gradient(
      circle at 0% 0%,
      rgba(79, 70, 229, 0.08),
      transparent 26%
    ),
    radial-gradient(
      circle at 100% 0%,
      rgba(6, 182, 212, 0.06),
      transparent 24%
    ),
    linear-gradient(
      180deg,
      #fcfdff 0%,
      var(--bg) 58%,
      #f3f6fb 100%
    );
}

.block-container {
  max-width: 1420px;
  padding-top: 1rem;
  padding-bottom: 2.5rem;
}

header,
footer,
#MainMenu {
  visibility: hidden;
}

/* ---------------------------------------------------------
   Sidebar
--------------------------------------------------------- */

[data-testid="stSidebar"] {
  border-right: 1px solid var(--line);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98),
      rgba(246, 248, 252, 0.98)
    );
}

[data-testid="stSidebar"] .block-container {
  padding-top: 1.25rem;
}

[data-testid="stSidebar"] h1,
[data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3,
[data-testid="stSidebar"] h4,
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] label {
  color: var(--text) !important;
}

[data-testid="stSidebar"] small,
[data-testid="stSidebar"] [data-testid="stCaptionContainer"] {
  color: var(--muted) !important;
}

div[data-testid="stExpander"] [data-testid="stMetric"] {
  min-height: 88px;
  padding: 0.8rem;
  border-radius: 14px;
  box-shadow: none;
}

div[data-testid="stExpander"] [data-testid="stMetricValue"] {
  font-size: 1.55rem !important;
}

/* ---------------------------------------------------------
   Top brand
--------------------------------------------------------- */

.rf-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.rf-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rf-logo {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  color: #ffffff;
  font-weight: 900;
  background:
    linear-gradient(
      135deg,
      var(--primary),
      var(--blue),
      var(--cyan)
    );
  box-shadow:
    0 10px 24px rgba(59, 130, 246, 0.18);
}

.rf-brand-meta {
  display: flex;
  flex-direction: column;
}

.rf-brand-name {
  margin: 0;
  color: var(--text);
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.1;
}

.rf-brand-copy {
  margin-top: 0.16rem;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.35;
}

.rf-status {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid rgba(22, 163, 74, 0.14);
  border-radius: 999px;
  color: #166534;
  background: var(--green-soft);
  font-size: 0.8rem;
  font-weight: 700;
}

.rf-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
}

/* ---------------------------------------------------------
   Insight summary spacing
--------------------------------------------------------- */

.rf-insights-heading {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  padding-left: 0.25rem;
  color: var(--text);
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.rf-insight-card {
  min-height: 132px;
  padding: 1.15rem 1.2rem;
}

/* Add breathing room around the highlight card row */
.rf-insights-row {
  padding: 0 0.25rem 0.4rem;
}

/* Slightly more internal space in highlight cards */
.rf-insights-row .rf-card {
  min-height: 132px;
  padding: 1.15rem 1.2rem;
}

/* ---------------------------------------------------------
   Hero
--------------------------------------------------------- */

.rf-hero {
  position: relative;
  overflow: hidden;
  margin-bottom: 1rem;
  padding: 2.2rem;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 28px;
  color: #ffffff;
  background:
    radial-gradient(
      circle at 82% 18%,
      rgba(255, 255, 255, 0.18),
      transparent 18%
    ),
    linear-gradient(
      135deg,
      #1e1b7a 0%,
      #4f46e5 40%,
      #2563eb 75%,
      #0ea5e9 100%
    );
  box-shadow: var(--shadow-lg);
}

.rf-hero::after {
  content: "";
  position: absolute;
  right: -8%;
  bottom: -52%;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  box-shadow:
    0 0 0 28px rgba(255, 255, 255, 0.04),
    0 0 0 60px rgba(255, 255, 255, 0.03),
    0 0 0 94px rgba(255, 255, 255, 0.02);
}

.rf-eyebrow {
  position: relative;
  z-index: 1;
  display: inline-flex;
  padding: 0.44rem 0.74rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.78rem;
  font-weight: 700;
}

.rf-hero h1 {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 1rem 0 0;
  color: #ffffff;
  font-size: clamp(2.35rem, 5vw, 4.5rem);
  font-weight: 900;
  letter-spacing: -0.05em;
  line-height: 1.02;
}

.rf-hero-copy {
  position: relative;
  z-index: 1;
  max-width: 760px;
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.03rem;
  line-height: 1.7;
}

.rf-features {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  max-width: 930px;
  margin-top: 1.4rem;
}

.rf-feature {
  padding: 0.9rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.rf-feature-title {
  display: block;
  margin-bottom: 0.28rem;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
}

.rf-feature-copy {
  display: block;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.78rem;
  line-height: 1.45;
}

/* ---------------------------------------------------------
   Streamlit bordered containers
--------------------------------------------------------- */

[data-testid="stVerticalBlockBorderWrapper"] {
  border: 1px solid var(--line) !important;
  border-radius: 22px !important;
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: var(--shadow-sm);
}

[data-testid="stVerticalBlockBorderWrapper"] > div {
  padding: 0.2rem;
}

/* ---------------------------------------------------------
   Section headings
--------------------------------------------------------- */

.rf-head {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  margin-bottom: 0.35rem;
}

.rf-step {
  display: inline-grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  color: #4338ca;
  background: #e9e8ff;
  font-size: 0.78rem;
  font-weight: 800;
}

.rf-title {
  margin: 0;
  color: var(--text);
  font-size: 1.12rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.rf-copy {
  margin: 0.18rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* ---------------------------------------------------------
   File metadata chips
--------------------------------------------------------- */

.rf-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.8rem;
  margin-bottom: 0.45rem;
}

.rf-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--text-secondary);
  background: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
}

/* ---------------------------------------------------------
   Custom cards
--------------------------------------------------------- */

.rf-card {
  min-height: 118px;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      #ffffff,
      #fbfdff
    );
  box-shadow: var(--shadow-sm);
}

.rf-card-label {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rf-card-value {
  margin-top: 0.42rem;
  color: var(--text);
  font-size: 1.45rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.rf-card-note {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.rf-mapping-card {
  display: flex;
  min-height: 148px;
  flex-direction: column;
  justify-content: center;
}

/* ---------------------------------------------------------
   Metrics
--------------------------------------------------------- */

[data-testid="stMetric"] {
  min-height: 110px;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      #ffffff,
      #fbfdff
    );
  box-shadow: var(--shadow-sm);
}

[data-testid="stMetricLabel"] {
  color: var(--muted) !important;
  font-size: 0.82rem !important;
  font-weight: 700 !important;
}

[data-testid="stMetricValue"] {
  color: var(--text) !important;
  font-size: 2rem !important;
  font-weight: 900 !important;
  letter-spacing: -0.03em;
}

[data-testid="stMetricDelta"] {
  color: var(--text-secondary) !important;
  font-weight: 700 !important;
}

[data-testid="stMetricDelta"] > div {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  color: var(--text-secondary) !important;
  background: var(--primary-soft);
}

[data-testid="stMetricDelta"] svg {
  color: inherit !important;
}

/* ---------------------------------------------------------
   File uploader
--------------------------------------------------------- */

div[data-testid="stFileUploader"] {
  padding: 0.9rem;
  border: 1.5px dashed rgba(79, 70, 229, 0.32);
  border-radius: 18px;
  background: #ffffff;
}

div[data-testid="stFileUploaderDropzone"] {
  padding: 1rem !important;
  border: 0 !important;
  border-radius: 14px !important;
  background: var(--surface-soft) !important;
}

div[data-testid="stFileUploaderDropzone"] span,
div[data-testid="stFileUploaderDropzone"] p {
  color: var(--text-secondary) !important;
}

div[data-testid="stFileUploaderDropzone"] small {
  color: var(--muted) !important;
}

div[data-testid="stFileUploaderDropzone"] button {
  border: 1px solid var(--line-strong) !important;
  border-radius: 10px !important;
  color: var(--text) !important;
  background: #ffffff !important;
  font-weight: 700 !important;
}

div[data-testid="stFileUploaderFile"] {
  border: 1px solid var(--line) !important;
  border-radius: 14px !important;
  background: #ffffff !important;
}

div[data-testid="stFileUploaderFile"] span,
div[data-testid="stFileUploaderFile"] p,
div[data-testid="stFileUploaderFileName"] {
  color: var(--text) !important;
  opacity: 1 !important;
  font-weight: 700 !important;
}

div[data-testid="stFileUploaderFile"] small {
  color: var(--muted) !important;
  opacity: 1 !important;
}

div[data-testid="stFileUploaderFile"] svg {
  color: var(--text-secondary) !important;
  fill: currentColor !important;
}

div[data-testid="stFileUploaderFile"] button {
  color: var(--text) !important;
  background: #ffffff !important;
}

div[data-testid="stFileUploaderFile"] button svg {
  color: var(--text) !important;
  fill: currentColor !important;
}

div[data-testid="stFileUploader"] button[kind="secondary"] {
  color: var(--text) !important;
  background: #ffffff !important;
}

/* ---------------------------------------------------------
   Select boxes and menus
--------------------------------------------------------- */

.stSelectbox label,
.stTextInput label {
  color: var(--text-secondary) !important;
  font-weight: 700 !important;
}

[data-baseweb="select"] > div {
  min-height: 3rem;
  border: 1px solid var(--line-strong) !important;
  border-radius: 12px !important;
  color: var(--text) !important;
  background: #ffffff !important;
  box-shadow: none !important;
}

[data-baseweb="select"] > div:hover {
  border-color: #818cf8 !important;
}

[data-baseweb="select"] span {
  color: var(--text) !important;
}

[data-baseweb="select"] svg {
  color: var(--text-secondary) !important;
  fill: currentColor !important;
}

[data-baseweb="popover"] {
  color: var(--text) !important;
}

[data-baseweb="menu"] {
  border: 1px solid var(--line) !important;
  background: #ffffff !important;
}

[data-baseweb="menu"] li {
  color: var(--text) !important;
  background: #ffffff !important;
}

[data-baseweb="menu"] li:hover {
  color: var(--text) !important;
  background: var(--primary-soft) !important;
}

/* ---------------------------------------------------------
   Buttons
--------------------------------------------------------- */

div.stButton > button,
div.stDownloadButton > button {
  min-height: 2.9rem;
  padding: 0.7rem 1.15rem;
  border: 0 !important;
  border-radius: 12px !important;
  color: #ffffff !important;
  background: var(--primary) !important;
  box-shadow:
    0 7px 18px rgba(79, 70, 229, 0.18);
  font-weight: 800 !important;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

div.stButton > button:hover,
div.stDownloadButton > button:hover {
  color: #ffffff !important;
  background: var(--primary-hover) !important;
  transform: translateY(-1px);
  box-shadow:
    0 10px 22px rgba(79, 70, 229, 0.22);
}

div.stButton > button:focus,
div.stDownloadButton > button:focus {
  color: #ffffff !important;
  background: var(--primary-hover) !important;
}

div.stButton > button p,
div.stDownloadButton > button p {
  color: #ffffff !important;
}

div.stButton > button:disabled {
  color: #94a3b8 !important;
  background: #e2e8f0 !important;
  box-shadow: none !important;
}

/* ---------------------------------------------------------
   Tables
--------------------------------------------------------- */

[data-testid="stDataFrame"] {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #ffffff;
}

/* ---------------------------------------------------------
   Dataframes
--------------------------------------------------------- */

[data-testid="stDataFrame"] {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #ffffff !important;
  box-shadow: none;
}

/* Dataframe toolbar */
[data-testid="stDataFrame"] [data-testid="stElementToolbar"] {
  color: var(--text) !important;
  background: #ffffff !important;
}

/* Dataframe toolbar icons */
[data-testid="stDataFrame"] button,
[data-testid="stDataFrame"] button svg {
  color: var(--text-secondary) !important;
}

/* ---------------------------------------------------------
   Plotly charts
--------------------------------------------------------- */

[data-testid="stPlotlyChart"] {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
}

/* ---------------------------------------------------------
   Tabs
--------------------------------------------------------- */

.stTabs [data-baseweb="tab-list"] {
  display: flex;
  gap: 0.35rem;
  padding: 0.35rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-muted);
}

.stTabs [data-baseweb="tab"] {
  min-height: 2.6rem;
  padding: 0 1rem;
  border: 0 !important;
  border-radius: 10px;
  color: var(--text-secondary) !important;
  background: transparent !important;
  font-weight: 700;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.stTabs [data-baseweb="tab"] p,
.stTabs [data-baseweb="tab"] span {
  color: inherit !important;
}

.stTabs [data-baseweb="tab"]:hover {
  color: var(--text) !important;
  background: #ffffff !important;
}

.stTabs [data-baseweb="tab"][aria-selected="true"] {
  color: #ffffff !important;
  background: var(--primary) !important;
  box-shadow:
    0 4px 12px rgba(79, 70, 229, 0.18);
}

.stTabs [data-baseweb="tab"][aria-selected="true"] p,
.stTabs [data-baseweb="tab"][aria-selected="true"] span {
  color: #ffffff !important;
}

.stTabs [data-baseweb="tab-highlight"] {
  display: none !important;
}

.stTabs [data-baseweb="tab-border"] {
  display: none !important;
}

.stTabs [data-baseweb="tab-panel"] {
  padding-top: 1rem;
}

/* ---------------------------------------------------------
   Expanders
--------------------------------------------------------- */

div[data-testid="stExpander"] {
  overflow: hidden;
  border: 1px solid var(--line) !important;
  border-radius: 16px !important;
  background: #ffffff !important;
  box-shadow: var(--shadow-sm);
}

/* Expander header */
div[data-testid="stExpander"] details > summary {
  min-height: 3.25rem;
  padding: 0.8rem 1rem !important;
  border: 0 !important;
  color: var(--text) !important;
  background: #ffffff !important;
  font-weight: 700 !important;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

/* Header hover */
div[data-testid="stExpander"] details > summary:hover {
  color: var(--primary) !important;
  background: var(--surface-soft) !important;
}

/* Text inside header */
div[data-testid="stExpander"] details > summary p,
div[data-testid="stExpander"] details > summary span,
div[data-testid="stExpander"] details > summary div {
  color: inherit !important;
}

/* Chevron */
div[data-testid="stExpander"] details > summary svg {
  color: var(--text-secondary) !important;
  fill: currentColor !important;
}

/* Expanded header */
div[data-testid="stExpander"] details[open] > summary {
  border-bottom: 1px solid var(--line) !important;
  color: var(--primary) !important;
  background: var(--primary-soft) !important;
}

/* Expander content */
div[data-testid="stExpander"] details > div {
  padding: 1rem !important;
  color: var(--text) !important;
  background: #ffffff !important;
}

div[data-testid="stAlert"] {
  border-radius: 16px !important;
}

/* ---------------------------------------------------------
   Layout spacing
--------------------------------------------------------- */

.rf-action-spacing {
  height: 1.4rem;
}

[data-testid="stHorizontalBlock"] {
  row-gap: 1rem;
}

.rf-footer {
  margin-top: 1.5rem;
  color: var(--muted);
  text-align: center;
  font-size: 0.78rem;
}

/* ---------------------------------------------------------
   Responsive behavior
--------------------------------------------------------- */

@media (max-width: 900px) {
  .rf-features {
    grid-template-columns: 1fr;
  }

  .rf-status {
    display: none;
  }

  .rf-hero {
    padding: 1.5rem;
  }

  .block-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .stTabs [data-baseweb="tab-list"] {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .stTabs [data-baseweb="tab"] {
    flex: 0 0 auto;
  }
}
</style>
""")

def section(
    step: str,
    title: str,
    description: str,
) -> None:
    render_html(
        f"""
<div class="rf-head">
  <div class="rf-step">{html.escape(step)}</div>
  <div>
    <div class="rf-title">{html.escape(title)}</div>
    <div class="rf-copy">{html.escape(description)}</div>
  </div>
</div>
"""
    )

def money(value: Any) -> str:
    if value is None:
        return "—"

    return f"${float(value):,.2f}"


def pct(value: Any) -> str:
    if value is None:
        return "—"

    return f"{float(value):.1%}"


def delta(value: Any) -> str | None:
    if value is None:
        return None

    return (
        f"{float(value):+.1%} "
        "vs previous month"
    )


def metric(
    metrics: Any,
    name: str,
    default: Any = None,
) -> Any:
    return getattr(
        metrics,
        name,
        default,
    )


def fingerprint(
    uploaded_file: Any,
) -> str:
    digest = hashlib.sha256(
        uploaded_file.getvalue()
    ).hexdigest()

    return (
        f"{uploaded_file.name}:"
        f"{digest}"
    )


def guess(
    columns: list[str],
    keywords: tuple[str, ...],
    fallback: int,
) -> int:
    for index, column in enumerate(columns):
        normalized = (
            column.lower()
            .replace("_", " ")
            .replace("-", " ")
            .replace("/", " ")
        )

        if any(
            keyword in normalized
            for keyword in keywords
        ):
            return index

    return min(
        fallback,
        len(columns) - 1,
    )


def find(
    columns: list[str],
    keywords: tuple[str, ...],
) -> int | None:
    for index, column in enumerate(columns):
        normalized = (
            column.lower()
            .replace("_", " ")
            .replace("-", " ")
            .replace("/", " ")
        )

        if any(
            keyword in normalized
            for keyword in keywords
        ):
            return index

    return None


def style_chart(
    figure: go.Figure,
    *,
    height: int = 410,
    show_legend: bool = True,
) -> go.Figure:
    figure.update_layout(
        template="plotly_white",
        height=height,
        margin=dict(l=22, r=22, t=56, b=22),
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font=dict(
            family="Inter, sans-serif",
            color="#0f172a",
            size=13,
        ),
        title=dict(
            font=dict(size=17, color="#0f172a"),
            x=0.02,
            xanchor="left",
        ),
        showlegend=show_legend,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            font=dict(color="#334155"),
        ),
        hoverlabel=dict(
            bgcolor="#ffffff",
            font_size=13,
            font_color="#0f172a",
        ),
        coloraxis_colorbar=dict(
            title=dict(
                font=dict(color="#334155"),
            ),
            tickfont=dict(color="#334155"),
        ),
    )

    figure.update_xaxes(
        showgrid=False,
        zeroline=False,
        linecolor="rgba(15,23,42,.12)",
        tickfont=dict(color="#475569"),
        title_font=dict(color="#64748b"),
    )

    figure.update_yaxes(
        gridcolor="rgba(15,23,42,.08)",
        zeroline=False,
        linecolor="rgba(15,23,42,.12)",
        tickfont=dict(color="#475569"),
        title_font=dict(color="#64748b"),
    )

    return figure


@st.cache_data(
    show_spinner=False,
)
def load_file(
    file_bytes: bytes,
    filename: str,
) -> pd.DataFrame:
    return read_tabular_file(
        BytesIO(file_bytes),
        filename,
    )


def highlights(
    summaries: dict[str, pd.DataFrame],
    clean_data: pd.DataFrame,
    rejected_data: pd.DataFrame,
) -> list[tuple[str, str, str]]:
    items: list[
        tuple[str, str, str]
    ] = []

    monthly = summaries.get(
        "monthly",
        pd.DataFrame(),
    )

    if (
        not monthly.empty
        and {
            "month",
            "revenue",
        }.issubset(monthly.columns)
    ):
        row = monthly.loc[
            monthly["revenue"].idxmax()
        ]

        items.append(
            (
                "Best month",
                str(row["month"]),
                (
                    f"{money(row['revenue'])} "
                    "revenue"
                ),
            )
        )

    products = summaries.get(
        "products",
        pd.DataFrame(),
    )

    if (
        not products.empty
        and {
            "product",
            "revenue",
        }.issubset(products.columns)
    ):
        row = products.iloc[0]

        items.append(
            (
                "Top product",
                str(row["product"]),
                (
                    f"{money(row['revenue'])} "
                    "revenue"
                ),
            )
        )

    customers = summaries.get(
        "customers",
        pd.DataFrame(),
    )

    if (
        not customers.empty
        and {
            "customer",
            "revenue",
        }.issubset(customers.columns)
    ):
        row = customers.iloc[0]

        items.append(
            (
                "Largest customer",
                str(row["customer"]),
                (
                    f"{money(row['revenue'])} "
                    "revenue"
                ),
            )
        )

    total_rows = (
        len(clean_data)
        + len(rejected_data)
    )

    rate = (
        len(clean_data) / total_rows
        if total_rows
        else 0
    )

    items.append(
        (
            "Data acceptance",
            f"{rate:.1%}",
            (
                f"{len(clean_data):,} "
                f"of {total_rows:,} rows used"
            ),
        )
    )

    return items[:4]


def render_highlights(
    items: list[tuple[str, str, str]],
) -> None:
    st.markdown(
        '<div style="height:0.15rem"></div>',
        unsafe_allow_html=True,
    )

    columns = st.columns(
        len(items),
        gap="medium",
    )

    for column, item in zip(columns, items):
        label, value, note = item

        with column:
            render_html(
                f"""
<div class="rf-card rf-insight-card">
  <div class="rf-card-label">
    {html.escape(label)}
  </div>

  <div class="rf-card-value">
    {html.escape(value)}
  </div>

  <div class="rf-card-note">
    {html.escape(note)}
  </div>
</div>
"""
            )

    st.markdown(
        '<div style="height:0.7rem"></div>',
        unsafe_allow_html=True,
    )


render_html(CSS)


render_html("""
<div class="rf-topbar">
  <div class="rf-brand">
    <div class="rf-logo">RF</div>
    <div class="rf-brand-meta">
      <div class="rf-brand-name">ReportForge</div>
      <div class="rf-brand-copy">Business intelligence from real-world spreadsheets</div>
    </div>
  </div>
</div>
""")


render_html("""
<div class="rf-hero">
  <h1>From messy data to decisions that move the business.</h1>
  <div class="rf-hero-copy">
    Upload a sales file and turn it into a clean, interactive performance report with executive KPIs, customer and product analysis, anomaly detection, and a professional Excel export.
  </div>
  <div class="rf-features">
    <div class="rf-feature">
      <div class="rf-feature-title">Recover messy files</div>
      <div class="rf-feature-copy">Handles delimiters, title rows, spacing issues, and malformed values.</div>
    </div>
    <div class="rf-feature">
      <div class="rf-feature-title">Find performance drivers</div>
      <div class="rf-feature-copy">Explore revenue, profit, margins, concentration, customers, and trends.</div>
    </div>
    <div class="rf-feature">
      <div class="rf-feature-title">Export polished reports</div>
      <div class="rf-feature-copy">Deliver clean tables, summaries, charts, and quality findings.</div>
    </div>
  </div>
</div>
""")


with st.sidebar:
    st.markdown(
        "### Report settings"
    )

    st.caption(
        "Control dashboard detail "
        "and ranking depth."
    )

    top_n = st.slider(
        "Items shown in rankings",
        min_value=5,
        max_value=25,
        value=10,
    )

    show_profile = st.toggle(
        "Show source-data profile",
        value=True,
    )

    show_tables = st.toggle(
        "Show detailed tables",
        value=True,
    )

    st.divider()

    st.markdown(
        "#### Data handling"
    )

    st.caption(
        "Files are processed for the "
        "current session. Add authentication, "
        "retention controls, and a privacy "
        "policy before accepting sensitive data."
    )


with st.container(border=True):
    section(
        "01",
        "Connect your data",
        "Upload a CSV or Excel workbook containing sales, customer, product, revenue, and optional cost data.",
    )

    st.markdown(
        '<div style="margin-top:.5rem;"></div>',
        unsafe_allow_html=True,
    )

    uploaded_file = st.file_uploader(
        "Upload a sales file",
        type=["csv", "xlsx"],
        help=(
            "The importer can recover common delimiter, encoding, spacing, "
            "and title-row issues."
        ),
        label_visibility="collapsed",
    )

    st.caption(
        "Supported formats: CSV and XLSX. Cost is optional, but required for margin analysis."
    )


if uploaded_file is None:
    with st.container(
        border=True,
    ):
        section(
            "Start",
            "Upload your first dataset",
            (
                "Choose a file and ReportForge "
                "will inspect it, recover its "
                "structure, and guide you through "
                "field mapping."
            ),
        )

    render_html("""
<div class="rf-footer">
  ReportForge · Clear business intelligence from complex spreadsheets
</div>
""")

    st.stop()


current_file_key = fingerprint(
    uploaded_file
)

if (
    st.session_state.get(
        "active_file_key"
    )
    != current_file_key
):
    st.session_state[
        "active_file_key"
    ] = current_file_key

    st.session_state.pop(
        "analysis_result",
        None,
    )

    st.session_state.pop(
        "analysis_mapping",
        None,
    )


try:
    with st.spinner(
        "Inspecting file structure and "
        "preparing the data preview..."
    ):
        raw_data = load_file(
            uploaded_file.getvalue(),
            uploaded_file.name,
        )

except ReportForgeError as exc:
    st.error(
        str(exc)
    )
    st.stop()

except Exception as exc:
    st.error(
        "The file could not be imported."
    )

    with st.expander(
        "Technical details"
    ):
        st.exception(
            exc
        )

    st.stop()


st.success(
    "Your file was imported successfully."
)


missing_cells = int(
    raw_data.isna()
    .sum()
    .sum()
)

duplicate_rows = int(
    raw_data.duplicated()
    .sum()
)


st.markdown(
    f"""
<div class="rf-chips">
  <span class="rf-chip">
    File: {html.escape(uploaded_file.name)}
  </span>

  <span class="rf-chip">
    {len(raw_data):,} records
  </span>

  <span class="rf-chip">
    {len(raw_data.columns):,} fields
  </span>

  <span class="rf-chip">
    {missing_cells:,} missing cells
  </span>

  <span class="rf-chip">
    {duplicate_rows:,} duplicate rows
  </span>
</div>
""",
    unsafe_allow_html=True,
)


if show_profile:
    with st.expander(
    "Source data preview",
    expanded=False,
):
        profile_one, profile_two, profile_three, profile_four = st.columns(4)

profile_one.metric("Rows", f"{len(raw_data):,}")
profile_two.metric("Columns", f"{len(raw_data.columns):,}")
profile_three.metric("Missing", f"{missing_cells:,}")
profile_four.metric("Duplicates", f"{duplicate_rows:,}")

st.dataframe(
    raw_data.head(20),
    use_container_width=True,
    hide_index=True,
    height=320,
)


columns = [
    str(column)
    for column in raw_data.columns
]


with st.container(border=True):
    section(
        "02",
        "Confirm the business fields",
        (
            "Match your spreadsheet columns to the fields "
            "ReportForge uses for analysis."
        ),
    )

    mapping_row_one = st.columns(3, gap="large")

    with mapping_row_one[0]:
        date_column = st.selectbox(
            "Date",
            columns,
            index=guess(
                columns,
                ("date", "time", "day"),
                0,
            ),
        )

    with mapping_row_one[1]:
        customer_column = st.selectbox(
            "Customer",
            columns,
            index=guess(
                columns,
                ("customer", "client", "account", "buyer"),
                min(1, len(columns) - 1),
            ),
        )

    with mapping_row_one[2]:
        product_column = st.selectbox(
            "Product or service",
            columns,
            index=guess(
                columns,
                ("product", "service", "item", "sku"),
                min(2, len(columns) - 1),
            ),
        )

    mapping_row_two = st.columns([1, 1, 1], gap="large")

    with mapping_row_two[0]:
        revenue_column = st.selectbox(
            "Revenue",
            columns,
            index=guess(
                columns,
                ("revenue", "sales", "amount", "total", "price"),
                min(3, len(columns) - 1),
            ),
        )

    with mapping_row_two[1]:
        cost_match = find(
            columns,
            ("cost", "expense", "cogs"),
        )

        cost_options = [
            "No cost column",
            *columns,
        ]

        cost_column = st.selectbox(
            "Cost",
            cost_options,
            index=0 if cost_match is None else cost_match + 1,
        )

    with mapping_row_two[2]:
        render_html(
            """
<div class="rf-card rf-mapping-card">
  <div class="rf-card-label">Mapping model</div>
  <div class="rf-card-value">4 + 1</div>
  <div class="rf-card-note">
    Four required fields power the report.
    Cost enables profitability analysis.
  </div>
</div>
"""
        )

    required_columns = [
        date_column,
        customer_column,
        product_column,
        revenue_column,
    ]

    mapping_valid = (
        len(set(required_columns))
        == len(required_columns)
    )

    if not mapping_valid:
        st.warning(
            "Date, customer, product/service, and revenue "
            "must use different columns."
        )

    mapping = ColumnMapping(
        date=date_column,
        customer=customer_column,
        product=product_column,
        revenue=revenue_column,
        cost=(
            None
            if cost_column == "No cost column"
            else cost_column
        ),
    )

    st.markdown(
        '<div class="rf-action-spacing"></div>',
        unsafe_allow_html=True,
    )

    generate = st.button(
        "Generate business report",
        type="primary",
        use_container_width=True,
        disabled=not mapping_valid,
    )


mapping_signature = {
    "date": mapping.date,
    "customer": mapping.customer,
    "product": mapping.product,
    "revenue": mapping.revenue,
    "cost": mapping.cost,
}


if generate:
    try:
        with st.spinner(
            "Cleaning records, calculating KPIs, "
            "and building visualizations..."
        ):
            (
                clean_data,
                rejected_data,
            ) = prepare_sales_data(
                raw_data,
                mapping,
            )

            metrics = calculate_metrics(
                clean_data
            )

            summaries = build_summary_tables(
                clean_data
            )

            advanced = build_advanced_analytics(
                clean_data,
                comparison_days=30,
            )

            report_bytes = create_excel_report(
                clean_data,
                rejected_data,
                metrics,
                summaries,
            )

        st.session_state[
            "analysis_mapping"
        ] = mapping_signature

        st.session_state[
            "analysis_result"
        ] = {
            "clean_data": clean_data,
            "rejected_data": rejected_data,
            "metrics": metrics,
            "summaries": summaries,
            "report_bytes": report_bytes,
            "advanced": advanced,
        }

    except ReportForgeError as exc:
        st.error(
            str(exc)
        )
        st.stop()

    except Exception as exc:
        st.error(
            "An unexpected error occurred "
            "while generating the report."
        )

        with st.expander(
            "Technical details"
        ):
            st.exception(
                exc
            )

        st.stop()


result = st.session_state.get(
    "analysis_result"
)

stored_mapping = st.session_state.get(
    "analysis_mapping"
)


if (
    result is None
    or stored_mapping
    != mapping_signature
):
    st.info(
        "Confirm the field mapping, "
        "then generate the report."
    )

    st.stop()


clean_data = result[
    "clean_data"
]

rejected_data = result[
    "rejected_data"
]

metrics = result[
    "metrics"
]

summaries = result[
    "summaries"
]

advanced = result[
    "advanced"
]

decision_queue = advanced["decision_queue"]
revenue_bridge = advanced["revenue_bridge"]
customer_movement = advanced["customer_movement"]
rfm = advanced["rfm"]
customer_cadence = advanced["customer_cadence"]
cross_sell = advanced["cross_sell"]
product_momentum = advanced["product_momentum"]
resilience = advanced["resilience"]
period_window = advanced["period_window"]

report_bytes = result[
    "report_bytes"
]


monthly = summaries.get(
    "monthly",
    pd.DataFrame(),
)

products = summaries.get(
    "products",
    pd.DataFrame(),
)

customers = summaries.get(
    "customers",
    pd.DataFrame(),
)

weekdays = summaries.get(
    "weekdays",
    pd.DataFrame(),
)

anomalies = summaries.get(
    "anomalies",
    pd.DataFrame(),
)


with st.container(
    border=True,
):
    section(
        "03",
        "Business performance",
        (
            "A concise view of revenue, profit, "
            "customer behavior, concentration "
            "risk, and data quality."
        ),
    )

    scorecard_row_one = st.columns(4)

    scorecard_row_one[0].metric(
        "Revenue",
        money(
            metric(
                metrics,
                "total_revenue",
                0,
            )
        ),
        delta(
            metric(
                metrics,
                "revenue_growth",
            )
        ),
    )

    scorecard_row_one[1].metric(
        "Gross profit",
        money(
            metric(
                metrics,
                "gross_profit",
                0,
            )
        ),
        delta(
            metric(
                metrics,
                "profit_growth",
            )
        ),
    )

    scorecard_row_one[2].metric(
        "Gross margin",
        pct(
            metric(
                metrics,
                "gross_margin",
            )
        ),
    )

    scorecard_row_one[3].metric(
        "Average order",
        money(
            metric(
                metrics,
                "average_order_value",
                0,
            )
        ),
    )

    scorecard_row_two = st.columns(4)

    scorecard_row_two[0].metric(
        "Median order",
        money(
            metric(
                metrics,
                "median_order_value",
                0,
            )
        ),
    )

    scorecard_row_two[1].metric(
        "Repeat customers",
        pct(
            metric(
                metrics,
                "repeat_customer_rate",
                0,
            )
        ),
    )

    scorecard_row_two[2].metric(
        "Top-customer share",
        pct(
            metric(
                metrics,
                "top_customer_share",
                0,
            )
        ),
    )

    scorecard_row_two[3].metric(
        "Anomalies flagged",
        (
            f"{int(metric(metrics, 'anomaly_count', 0)):,}"
        ),
    )

    render_html("""
<div class="rf-insights-heading">
  What stands out
</div>
""")

render_highlights(
    highlights(
        summaries,
        clean_data,
        rejected_data,
    )
)

with st.container(border=True):
    section(
        "04",
        "Decision intelligence",
        (
            "Prioritized risks and opportunities with quantified "
            "impact, confidence, evidence, and recommended actions."
        ),
    )

    score_one, score_two, score_three, score_four = st.columns(4)

    score_one.metric(
        "Revenue resilience",
        f"{resilience.score:.0f}/100",
    )

    score_two.metric(
        "Confidence",
        f"{resilience.confidence:.0%}",
    )

    score_three.metric(
        "Effective customers",
        f"{resilience.effective_customer_count:.1f}",
    )

    score_four.metric(
        "Top-5 customer share",
        f"{resilience.top_five_customer_share:.1%}",
    )

    st.markdown("### Priority findings")

    if decision_queue.empty:
        st.info(
            "There is not enough data to generate prioritized findings."
        )
    else:
        for row in decision_queue.head(5).itertuples(index=False):
            impact = (
                "Not quantified"
                if pd.isna(row.impact_amount)
                else money(row.impact_amount)
            )

            st.markdown(
                f"#### {html.escape(str(row.title))}"
            )

            st.caption(
                f"{str(row.priority).upper()} · "
                f"{row.category} · "
                f"Impact: {impact} · "
                f"Confidence: {row.confidence:.0%}"
            )

            st.write(row.summary)

            st.info(
                f"Recommended action: {row.recommended_action}"
            )

            with st.expander("Evidence and calculation basis"):
                st.write(row.evidence)

    decision_tabs = st.tabs(
        [
            "Revenue bridge",
            "Customer health",
            "Purchase cadence",
            "Cross-sell",
            "Product momentum",
            "Customer movement",
        ]
    )

    with decision_tabs[0]:
        if revenue_bridge.empty:
            st.info("Revenue movement data is not available.")
        else:
            bridge_chart = go.Figure(
                go.Waterfall(
                    x=revenue_bridge["component"],
                    y=revenue_bridge["value"],
                    measure=[
                        (
                            "absolute"
                            if kind == "total"
                            else "relative"
                        )
                        for kind in revenue_bridge["kind"]
                    ],
                    connector={
                        "line": {
                            "color": "rgba(15,23,42,.25)"
                        }
                    },
                )
            )

            bridge_chart.update_layout(
                title=(
                    "Revenue movement: "
                    f"{period_window.previous_start:%b %d}–"
                    f"{period_window.previous_end:%b %d} vs "
                    f"{period_window.current_start:%b %d}–"
                    f"{period_window.current_end:%b %d}"
                )
            )

            st.plotly_chart(
                style_chart(
                    bridge_chart,
                    show_legend=False,
                ),
                use_container_width=True,
                config={"displayModeBar": False},
            )

    with decision_tabs[1]:
        st.dataframe(
            rfm,
            use_container_width=True,
            hide_index=True,
        )

    with decision_tabs[2]:
        st.dataframe(
            customer_cadence,
            use_container_width=True,
            hide_index=True,
        )

    with decision_tabs[3]:
        st.dataframe(
            cross_sell,
            use_container_width=True,
            hide_index=True,
        )

    with decision_tabs[4]:
        st.dataframe(
            product_momentum,
            use_container_width=True,
            hide_index=True,
        )

    with decision_tabs[5]:
        st.dataframe(
            customer_movement,
            use_container_width=True,
            hide_index=True,
        )

with st.container(
    border=True,
):
    section(
        "05",
        "Performance drivers",
        (
            "Explore changes over time and "
            "identify the products and customers "
            "that matter most."
        ),
    )

    chart_left, chart_right = st.columns(2)

    with chart_left:
        has_monthly_data = (
            not monthly.empty
            and {
                "month",
                "revenue",
            }.issubset(
                monthly.columns
            )
        )

        if has_monthly_data:
            trend_chart = go.Figure()

            trend_chart.add_trace(
                go.Scatter(
                    x=monthly["month"],
                    y=monthly["revenue"],
                    mode="lines+markers",
                    name="Revenue",
                    line=dict(
                        width=3,
                        color="#6d5dfc",
                    ),
                    fill="tozeroy",
                    fillcolor=(
                        "rgba(109,93,252,.10)"
                    ),
                    hovertemplate=(
                        "%{x}<br>"
                        "Revenue: $%{y:,.2f}"
                        "<extra></extra>"
                    ),
                )
            )

            if "profit" in monthly.columns:
                trend_chart.add_trace(
                    go.Scatter(
                        x=monthly["month"],
                        y=monthly["profit"],
                        mode="lines+markers",
                        name="Profit",
                        line=dict(
                            width=3,
                            color="#10b981",
                        ),
                        hovertemplate=(
                            "%{x}<br>"
                            "Profit: $%{y:,.2f}"
                            "<extra></extra>"
                        ),
                    )
                )

            trend_chart.update_layout(
                title=(
                    "Revenue and profit trend"
                ),
                hovermode="x unified",
            )

            st.plotly_chart(
                style_chart(
                    trend_chart
                ),
                use_container_width=True,
                config={
                    "displayModeBar": False,
                },
            )

        else:
            st.info(
                "Monthly trend data "
                "is not available."
            )

    with chart_right:
        has_product_data = (
            not products.empty
            and {
                "product",
                "revenue",
            }.issubset(
                products.columns
            )
        )

        if has_product_data:
            top_products = (
                products.head(top_n)
                .sort_values("revenue")
                .copy()
            )

            product_color = (
                "margin"
                if "margin"
                in top_products.columns
                else None
            )

            product_chart = px.bar(
                top_products,
                x="revenue",
                y="product",
                orientation="h",
                color=product_color,
                color_continuous_scale=(
                    "Viridis"
                    if product_color
                    else None
                ),
                title=(
                    "Top products by revenue"
                ),
            )

            product_chart.update_traces(
                hovertemplate=(
                    "%{y}<br>"
                    "Revenue: $%{x:,.2f}"
                    "<extra></extra>"
                )
            )

            st.plotly_chart(
                style_chart(
                    product_chart,
                    show_legend=False,
                ),
                use_container_width=True,
                config={
                    "displayModeBar": False,
                },
            )

        else:
            st.info(
                "Product performance data "
                "is not available."
            )

    chart_left, chart_right = st.columns(2)

    with chart_left:
        has_customer_data = (
            not customers.empty
            and {
                "customer",
                "revenue",
            }.issubset(
                customers.columns
            )
        )

        if has_customer_data:
            top_customers = (
                customers.head(top_n)
                .copy()
            )

            customer_color = (
                "profit"
                if "profit"
                in top_customers.columns
                else "revenue"
            )

            customer_chart = px.treemap(
                top_customers,
                path=["customer"],
                values="revenue",
                color=customer_color,
                color_continuous_scale=(
                    "RdYlGn"
                ),
                title=(
                    "Customer revenue concentration"
                ),
            )

            customer_chart.update_traces(
                textinfo=(
                    "label+percent parent"
                ),
                hovertemplate=(
                    "<b>%{label}</b><br>"
                    "Revenue: $%{value:,.2f}"
                    "<extra></extra>"
                ),
            )

            st.plotly_chart(
                style_chart(
                    customer_chart
                ),
                use_container_width=True,
                config={
                    "displayModeBar": False,
                },
            )

        else:
            st.info(
                "Customer concentration data "
                "is not available."
            )

    with chart_right:
        has_weekday_data = (
            not weekdays.empty
            and {
                "weekday",
                "revenue",
            }.issubset(
                weekdays.columns
            )
        )

        if has_weekday_data:
            weekday_color = (
                "transactions"
                if "transactions"
                in weekdays.columns
                else None
            )

            weekday_chart = px.bar(
                weekdays,
                x="weekday",
                y="revenue",
                color=weekday_color,
                color_continuous_scale=(
                    "Plasma"
                    if weekday_color
                    else None
                ),
                title=(
                    "Revenue by weekday"
                ),
            )

            weekday_chart.update_traces(
                hovertemplate=(
                    "%{x}<br>"
                    "Revenue: $%{y:,.2f}"
                    "<extra></extra>"
                )
            )

            st.plotly_chart(
                style_chart(
                    weekday_chart,
                    show_legend=False,
                ),
                use_container_width=True,
                config={
                    "displayModeBar": False,
                },
            )

        else:
            st.info(
                "Weekday performance data "
                "is not available."
            )


if show_tables:
    with st.container(
        border=True,
    ):
        section(
            "06",
            "Detailed analysis",
            (
                "Inspect monthly, product, customer, "
                "clean-data, and data-quality tables."
            ),
        )

        tabs = st.tabs(
            [
                "Monthly",
                "Products",
                "Customers",
                "Data quality",
                "Clean data",
            ]
        )

        with tabs[0]:
            st.dataframe(
                monthly,
                use_container_width=True,
                hide_index=True,
            )

        with tabs[1]:
            st.dataframe(
                products,
                use_container_width=True,
                hide_index=True,
            )

        with tabs[2]:
            st.dataframe(
                customers,
                use_container_width=True,
                hide_index=True,
            )

        with tabs[3]:
            (
                quality_one,
                quality_two,
                quality_three,
            ) = st.columns(3)

            quality_one.metric(
                "Accepted rows",
                f"{len(clean_data):,}",
            )

            quality_two.metric(
                "Rejected rows",
                f"{len(rejected_data):,}",
            )

            quality_three.metric(
                "Anomalies",
                (
                    f"{int(metric(metrics, 'anomaly_count', 0)):,}"
                ),
            )

            if not rejected_data.empty:
                st.markdown(
                    "#### Rejected records"
                )

                st.dataframe(
                    rejected_data,
                    use_container_width=True,
                    hide_index=True,
                )

            if not anomalies.empty:
                st.markdown(
                    "#### Unusual transactions"
                )

                st.dataframe(
                    anomalies,
                    use_container_width=True,
                    hide_index=True,
                )

            if (
                rejected_data.empty
                and anomalies.empty
            ):
                st.success(
                    "No rejected or unusual "
                    "records were found."
                )

        with tabs[4]:
            st.dataframe(
                clean_data,
                use_container_width=True,
                hide_index=True,
            )


with st.container(
    border=True,
):
    section(
        "07",
        "Export the report",
        (
            "Download a formatted workbook "
            "with the executive summary, "
            "analysis tables, clean data, "
            "and quality findings."
        ),
    )

    export_left, export_right = (
        st.columns(
            [
                2,
                1,
            ]
        )
    )

    with export_left:
        st.download_button(
            "Download Excel report",
            data=report_bytes,
            file_name=(
                "reportforge_business_report.xlsx"
            ),
            mime=(
                "application/vnd.openxmlformats-"
                "officedocument.spreadsheetml.sheet"
            ),
            type="primary",
            use_container_width=True,
        )

    with export_right:
        st.metric(
            "Report rows",
            f"{len(clean_data):,}",
            help="Number of accepted rows included in the exported report.",
        )


render_html("""
<div class="rf-footer">
  ReportForge · Clear business intelligence from complex spreadsheets
</div>
""")