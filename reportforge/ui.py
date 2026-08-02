from __future__ import annotations

import html
from typing import Iterable, Mapping

import streamlit as st


APP_CSS = """
<style>
:root {
  --rf-bg: #f6f6f3;
  --rf-surface: #ffffff;
  --rf-surface-subtle: #fafaf8;
  --rf-text: #181817;
  --rf-muted: #6b6b66;
  --rf-border: #e5e5df;
  --rf-border-strong: #d2d2ca;
  --rf-accent: #2457e6;
  --rf-accent-soft: #edf2ff;
  --rf-positive: #147a5b;
  --rf-positive-soft: #eaf7f1;
  --rf-warning: #936400;
  --rf-warning-soft: #fff7df;
  --rf-danger: #b42318;
  --rf-danger-soft: #fff0ee;
  --rf-radius: 14px;
  --rf-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
}

html,
body,
[class*="css"],
[data-testid="stAppViewContainer"] {
  font-family:
    "Avenir Next",
    Avenir,
    "Segoe UI Variable",
    "Segoe UI",
    "Helvetica Neue",
    Arial,
    sans-serif;
}

.stApp {
  color: var(--rf-text);
  background: var(--rf-bg);
}

.block-container {
  max-width: 1220px;
  padding-top: 1.4rem;
  padding-bottom: 4rem;
}

header,
footer,
#MainMenu {
  visibility: hidden;
}

[data-testid="stSidebar"] {
  border-right: 1px solid var(--rf-border);
  background: var(--rf-surface);
}

[data-testid="stSidebar"] .block-container {
  padding-top: 1.3rem;
  padding-left: 1.15rem;
  padding-right: 1.15rem;
}

[data-testid="stSidebar"] hr {
  border-color: var(--rf-border);
}

h1,
h2,
h3,
h4,
p,
label,
span,
div {
  letter-spacing: normal;
}

.rf-brandbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.rf-brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.rf-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  color: #ffffff;
  background: var(--rf-text);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.rf-brand-name {
  color: var(--rf-text);
  font-size: 1rem;
  font-weight: 750;
}

.rf-brand-subtitle {
  margin-top: 0.05rem;
  color: var(--rf-muted);
  font-size: 0.73rem;
}

.rf-topmeta {
  color: var(--rf-muted);
  font-size: 0.78rem;
}

.rf-pagehead {
  margin: 0 0 1.15rem;
}

.rf-eyebrow {
  margin-bottom: 0.3rem;
  color: var(--rf-accent);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rf-page-title {
  margin: 0;
  color: var(--rf-text);
  font-size: clamp(1.8rem, 3vw, 2.55rem);
  font-weight: 760;
  letter-spacing: -0.045em;
  line-height: 1.08;
}

.rf-page-copy {
  max-width: 760px;
  margin-top: 0.55rem;
  color: var(--rf-muted);
  font-size: 0.98rem;
  line-height: 1.65;
}

.rf-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.5rem 0 0.75rem;
}

.rf-section-title {
  color: var(--rf-text);
  font-size: 1.08rem;
  font-weight: 740;
  letter-spacing: -0.02em;
}

.rf-section-copy {
  max-width: 700px;
  margin-top: 0.2rem;
  color: var(--rf-muted);
  font-size: 0.83rem;
  line-height: 1.5;
}

.rf-brief {
  padding: 1.3rem 1.35rem;
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
  box-shadow: var(--rf-shadow);
}

.rf-brief-label {
  color: var(--rf-muted);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.rf-brief-title {
  max-width: 900px;
  margin-top: 0.42rem;
  color: var(--rf-text);
  font-size: clamp(1.35rem, 2.7vw, 2rem);
  font-weight: 740;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.rf-brief-copy {
  max-width: 900px;
  margin-top: 0.5rem;
  color: var(--rf-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

.rf-kpi {
  min-height: 126px;
  padding: 1rem 1.05rem;
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
  box-shadow: var(--rf-shadow);
}

.rf-kpi-label {
  color: var(--rf-muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.rf-kpi-value {
  margin-top: 0.45rem;
  color: var(--rf-text);
  font-size: 1.75rem;
  font-weight: 760;
  letter-spacing: -0.045em;
  line-height: 1.05;
}

.rf-kpi-helper {
  margin-top: 0.45rem;
  color: var(--rf-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.rf-delta {
  display: inline-flex;
  margin-top: 0.45rem;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 750;
}

.rf-delta-positive {
  color: var(--rf-positive);
  background: var(--rf-positive-soft);
}

.rf-delta-negative {
  color: var(--rf-danger);
  background: var(--rf-danger-soft);
}

.rf-delta-neutral {
  color: var(--rf-muted);
  background: #f1f1ed;
}

.rf-insight {
  padding: 1rem 1.05rem;
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
  box-shadow: var(--rf-shadow);
}

.rf-insight + .rf-insight {
  margin-top: 0.65rem;
}

.rf-insight-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.rf-insight-title {
  color: var(--rf-text);
  font-size: 0.92rem;
  font-weight: 740;
  line-height: 1.35;
}

.rf-insight-meta {
  flex: 0 0 auto;
  color: var(--rf-muted);
  font-size: 0.7rem;
  font-weight: 700;
}

.rf-insight-copy {
  margin-top: 0.4rem;
  color: var(--rf-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.rf-insight-action {
  margin-top: 0.55rem;
  color: var(--rf-text);
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.5;
}

.rf-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.23rem 0.48rem;
  border-radius: 999px;
  font-size: 0.67rem;
  font-weight: 780;
  text-transform: uppercase;
}

.rf-pill-critical,
.rf-pill-high {
  color: var(--rf-danger);
  background: var(--rf-danger-soft);
}

.rf-pill-medium {
  color: var(--rf-warning);
  background: var(--rf-warning-soft);
}

.rf-pill-opportunity {
  color: var(--rf-positive);
  background: var(--rf-positive-soft);
}

.rf-pill-info {
  color: var(--rf-accent);
  background: var(--rf-accent-soft);
}

.rf-fileline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin: 0.15rem 0 0.85rem;
}

.rf-chip {
  display: inline-flex;
  padding: 0.28rem 0.55rem;
  border: 1px solid var(--rf-border);
  border-radius: 999px;
  color: var(--rf-muted);
  background: var(--rf-surface);
  font-size: 0.72rem;
  font-weight: 650;
}

.rf-note {
  padding: 0.9rem 1rem;
  border: 1px solid var(--rf-border);
  border-left: 3px solid var(--rf-accent);
  border-radius: 10px;
  color: var(--rf-muted);
  background: var(--rf-surface);
  font-size: 0.8rem;
  line-height: 1.55;
}

.rf-empty {
  padding: 2rem 1.2rem;
  border: 1px dashed var(--rf-border-strong);
  border-radius: var(--rf-radius);
  color: var(--rf-muted);
  background: var(--rf-surface-subtle);
  text-align: center;
  font-size: 0.84rem;
}

[data-testid="stVerticalBlockBorderWrapper"] {
  border-color: var(--rf-border) !important;
  border-radius: var(--rf-radius) !important;
  background: var(--rf-surface) !important;
  box-shadow: var(--rf-shadow);
}

[data-testid="stMetric"] {
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
}

[data-testid="stDataFrame"] {
  overflow: hidden;
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
}

[data-testid="stPlotlyChart"] {
  overflow: hidden;
  border: 1px solid var(--rf-border);
  border-radius: var(--rf-radius);
  background: var(--rf-surface);
}

[data-testid="stFileUploader"] {
  padding: 0.65rem;
  border: 1px dashed var(--rf-border-strong);
  border-radius: var(--rf-radius);
  background: var(--rf-surface-subtle);
}

[data-testid="stFileUploaderDropzone"] {
  border: 0 !important;
  background: transparent !important;
}

.stButton > button,
.stDownloadButton > button,
button[kind="primary"],
button[data-testid="stBaseButton-primary"] {
  min-height: 2.65rem;
  border: 1px solid var(--rf-text) !important;
  border-radius: 10px !important;
  color: #ffffff !important;
  background: var(--rf-text) !important;
  box-shadow: none !important;
  font-weight: 720 !important;
}

.stButton > button p,
.stButton > button span,
.stDownloadButton > button p,
.stDownloadButton > button span,
button[kind="primary"] p,
button[kind="primary"] span,
button[data-testid="stBaseButton-primary"] p,
button[data-testid="stBaseButton-primary"] span {
  color: #ffffff !important;
}

.stButton > button:hover,
.stDownloadButton > button:hover,
button[kind="primary"]:hover,
button[data-testid="stBaseButton-primary"]:hover {
  border-color: #000000 !important;
  color: #ffffff !important;
  background: #000000 !important;
}

.stButton > button:hover p,
.stButton > button:hover span,
.stDownloadButton > button:hover p,
.stDownloadButton > button:hover span,
button[kind="primary"]:hover p,
button[kind="primary"]:hover span,
button[data-testid="stBaseButton-primary"]:hover p,
button[data-testid="stBaseButton-primary"]:hover span {
  color: #ffffff !important;
}

div.stButton > button[kind="secondary"],
div.stButton > button[data-testid="stBaseButton-secondary"],
div.stDownloadButton > button[kind="secondary"],
div.stDownloadButton > button[data-testid="stBaseButton-secondary"] {
  border: 1px solid var(--rf-border-strong) !important;
  border-radius: 10px !important;
  color: var(--rf-text) !important;
  background: var(--rf-surface) !important;
  box-shadow: none !important;
}

div.stButton > button[kind="secondary"] p,
div.stButton > button[kind="secondary"] span,
div.stButton > button[data-testid="stBaseButton-secondary"] p,
div.stButton > button[data-testid="stBaseButton-secondary"] span,
div.stDownloadButton > button[kind="secondary"] p,
div.stDownloadButton > button[kind="secondary"] span,
div.stDownloadButton > button[data-testid="stBaseButton-secondary"] p,
div.stDownloadButton > button[data-testid="stBaseButton-secondary"] span {
  color: var(--rf-text) !important;
}

div.stButton > button[kind="secondary"]:hover,
div.stButton > button[data-testid="stBaseButton-secondary"]:hover,
div.stDownloadButton > button[kind="secondary"]:hover,
div.stDownloadButton > button[data-testid="stBaseButton-secondary"]:hover {
  border-color: var(--rf-text) !important;
  color: var(--rf-text) !important;
  background: #ecece8 !important;
}

div.stButton > button[kind="secondary"]:hover p,
div.stButton > button[kind="secondary"]:hover span,
div.stButton > button[data-testid="stBaseButton-secondary"]:hover p,
div.stButton > button[data-testid="stBaseButton-secondary"]:hover span,
div.stDownloadButton > button[kind="secondary"]:hover p,
div.stDownloadButton > button[kind="secondary"]:hover span,
div.stDownloadButton > button[data-testid="stBaseButton-secondary"]:hover p,
div.stDownloadButton > button[data-testid="stBaseButton-secondary"]:hover span {
  color: var(--rf-text) !important;
}

.stSelectbox label,
.stMultiSelect label,
.stDateInput label,
.stTextInput label,
.stRadio label,
.stSlider label {
  color: var(--rf-text) !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
}

[data-baseweb="select"] > div,
[data-baseweb="input"] > div,
[data-testid="stDateInput"] input {
  border-color: var(--rf-border-strong) !important;
  border-radius: 10px !important;
  background: var(--rf-surface) !important;
  box-shadow: none !important;
}

.stRadio [role="radiogroup"] {
  gap: 0.2rem;
}

.stRadio [role="radiogroup"] label {
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
}

.stRadio [role="radiogroup"] label:hover {
  background: var(--rf-surface-subtle);
}

div[data-testid="stExpander"] {
  border: 1px solid var(--rf-border) !important;
  border-radius: 10px !important;
  background: var(--rf-surface) !important;
  box-shadow: none !important;
}

div[data-testid="stExpander"] details > summary {
  color: var(--rf-text) !important;
  background: var(--rf-surface) !important;
  font-size: 0.8rem !important;
  font-weight: 680 !important;
}

[data-testid="stAlert"] {
  border-radius: 10px !important;
}

@media (max-width: 760px) {
  .block-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .rf-brandbar,
  .rf-section-head,
  .rf-insight-topline {
    align-items: flex-start;
    flex-direction: column;
  }

  .rf-topmeta {
    display: none;
  }
}
</style>
"""


def inject_styles() -> None:
    st.markdown(APP_CSS, unsafe_allow_html=True)


def render_brand(*, meta: str | None = None) -> None:
    meta_markup = html.escape(meta) if meta else ""
    st.markdown(
        f"""
<div class="rf-brandbar">
  <div class="rf-brand">
    <div>
      <div class="rf-brand-name">ReportForge</div>
      <div class="rf-brand-subtitle">Business reporting without the busywork</div>
    </div>
  </div>
  <div class="rf-topmeta">{meta_markup}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_page_header(
    title: str,
    description: str,
    *,
    eyebrow: str | None = None,
) -> None:
    eyebrow_markup = (
        f'<div class="rf-eyebrow">{html.escape(eyebrow)}</div>'
        if eyebrow
        else ""
    )
    st.markdown(
        f"""
<div class="rf-pagehead">
  {eyebrow_markup}
  <h1 class="rf-page-title">{html.escape(title)}</h1>
  <div class="rf-page-copy">{html.escape(description)}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_section_header(title: str, description: str | None = None) -> None:
    copy = (
        f'<div class="rf-section-copy">{html.escape(description)}</div>'
        if description
        else ""
    )
    st.markdown(
        f"""
<div class="rf-section-head">
  <div>
    <div class="rf-section-title">{html.escape(title)}</div>
    {copy}
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_brief(label: str, title: str, description: str) -> None:
    st.markdown(
        f"""
<div class="rf-brief">
  <div class="rf-brief-label">{html.escape(label)}</div>
  <div class="rf-brief-title">{html.escape(title)}</div>
  <div class="rf-brief-copy">{html.escape(description)}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_kpis(cards: Iterable[Mapping[str, str | None]]) -> None:
    card_list = list(cards)
    if not card_list:
        return

    columns = st.columns(len(card_list), gap="small")
    for column, card in zip(columns, card_list):
        delta = card.get("delta")
        tone = card.get("tone") or "neutral"
        delta_markup = (
            f'<div class="rf-delta rf-delta-{html.escape(tone)}">{html.escape(str(delta))}</div>'
            if delta
            else ""
        )
        with column:
            st.markdown(
                f"""
<div class="rf-kpi">
  <div class="rf-kpi-label">{html.escape(str(card.get('label', '')))}</div>
  <div class="rf-kpi-value">{html.escape(str(card.get('value', '—')))}</div>
  {delta_markup}
  <div class="rf-kpi-helper">{html.escape(str(card.get('helper', '')))}</div>
</div>
""",
                unsafe_allow_html=True,
            )


def render_file_chips(items: Iterable[str]) -> None:
    chips = "".join(
        f'<span class="rf-chip">{html.escape(str(item))}</span>'
        for item in items
    )
    st.markdown(
        f'<div class="rf-fileline">{chips}</div>',
        unsafe_allow_html=True,
    )


def render_insight(
    *,
    priority: str,
    title: str,
    summary: str,
    action: str,
    meta: str,
) -> None:
    safe_priority = priority.lower()
    if safe_priority not in {"critical", "high", "medium", "opportunity", "info"}:
        safe_priority = "info"

    st.markdown(
        f"""
<div class="rf-insight">
  <div class="rf-insight-topline">
    <div class="rf-insight-title">
      <span class="rf-pill rf-pill-{safe_priority}">{html.escape(priority)}</span>
      &nbsp;{html.escape(title)}
    </div>
    <div class="rf-insight-meta">{html.escape(meta)}</div>
  </div>
  <div class="rf-insight-copy">{html.escape(summary)}</div>
  <div class="rf-insight-action">Next step: {html.escape(action)}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_note(text: str) -> None:
    st.markdown(
        f'<div class="rf-note">{html.escape(text)}</div>',
        unsafe_allow_html=True,
    )


def render_empty(text: str) -> None:
    st.markdown(
        f'<div class="rf-empty">{html.escape(text)}</div>',
        unsafe_allow_html=True,
    )
