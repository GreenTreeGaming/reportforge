from __future__ import annotations

from dataclasses import asdict, dataclass
from math import log1p
from typing import Literal

import pandas as pd


Priority = Literal["critical", "high", "medium", "opportunity", "info"]


@dataclass(frozen=True)
class PeriodWindow:
    current_start: pd.Timestamp
    current_end: pd.Timestamp
    previous_start: pd.Timestamp
    previous_end: pd.Timestamp
    days: int


@dataclass(frozen=True)
class RevenueResilience:
    score: float
    confidence: float
    concentration_score: float
    repeatability_score: float
    stability_score: float
    margin_consistency_score: float | None
    top_customer_share: float
    top_five_customer_share: float
    hhi: float
    effective_customer_count: float
    gini: float
    monthly_revenue_cv: float | None


@dataclass(frozen=True)
class DecisionInsight:
    insight_id: str
    priority: Priority
    category: str
    title: str
    summary: str
    recommended_action: str
    impact_amount: float | None
    impact_share: float | None
    confidence: float
    evidence: str


REQUIRED_COLUMNS = {
    "date",
    "customer",
    "product",
    "revenue",
    "profit",
}


def _validate(data: pd.DataFrame) -> None:
    missing = REQUIRED_COLUMNS.difference(data.columns)
    if missing:
        formatted = ", ".join(sorted(missing))
        raise ValueError(f"Advanced analytics requires these columns: {formatted}.")
    if data.empty:
        raise ValueError("Advanced analytics requires at least one valid transaction.")


def _safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _pct_rank_score(series: pd.Series, *, higher_is_better: bool) -> pd.Series:
    """Return stable 1-5 scores, including for small or tied datasets."""
    if higher_is_better:
        ranked = series.rank(method="average", pct=True, ascending=True)
    else:
        ranked = series.rank(method="average", pct=True, ascending=False)
    return (ranked.mul(5).apply(lambda value: max(1, min(5, int(value + 0.999999))))).astype(int)


def _gini(values: pd.Series) -> float:
    clean = pd.to_numeric(values, errors="coerce").dropna().clip(lower=0).sort_values()
    if clean.empty or float(clean.sum()) == 0:
        return 0.0

    count = len(clean)
    weighted_sum = sum((index + 1) * float(value) for index, value in enumerate(clean))
    return (2 * weighted_sum) / (count * float(clean.sum())) - (count + 1) / count


def rolling_period_window(data: pd.DataFrame, days: int = 30) -> PeriodWindow:
    _validate(data)
    if days < 7:
        raise ValueError("The comparison window must be at least 7 days.")

    current_end = pd.Timestamp(data["date"].max()).normalize()
    current_start = current_end - pd.Timedelta(days=days - 1)
    previous_end = current_start - pd.Timedelta(days=1)
    previous_start = previous_end - pd.Timedelta(days=days - 1)

    return PeriodWindow(
        current_start=current_start,
        current_end=current_end,
        previous_start=previous_start,
        previous_end=previous_end,
        days=days,
    )


def build_customer_movement(
    data: pd.DataFrame,
    *,
    days: int = 30,
) -> tuple[pd.DataFrame, pd.DataFrame, PeriodWindow]:
    """
    Attribute revenue change to new, expansion, contraction, and lost customers.

    This is a transactional revenue bridge, not subscription MRR/ARR accounting.
    """
    _validate(data)
    window = rolling_period_window(data, days=days)

    current = data.loc[data["date"].between(window.current_start, window.current_end)]
    previous = data.loc[data["date"].between(window.previous_start, window.previous_end)]

    current_revenue = current.groupby("customer")["revenue"].sum().rename("current_revenue")
    previous_revenue = previous.groupby("customer")["revenue"].sum().rename("previous_revenue")

    movement = (
        pd.concat([previous_revenue, current_revenue], axis=1)
        .fillna(0.0)
        .reset_index()
    )
    movement["revenue_delta"] = movement["current_revenue"] - movement["previous_revenue"]

    both = movement["previous_revenue"].gt(0) & movement["current_revenue"].gt(0)
    movement["status"] = "unchanged"
    movement.loc[
        movement["previous_revenue"].eq(0) & movement["current_revenue"].gt(0),
        "status",
    ] = "new"
    movement.loc[
        movement["previous_revenue"].gt(0) & movement["current_revenue"].eq(0),
        "status",
    ] = "lost"
    movement.loc[both & movement["revenue_delta"].gt(0), "status"] = "expanded"
    movement.loc[both & movement["revenue_delta"].lt(0), "status"] = "contracted"

    customer_dates = data.groupby("customer")["date"].agg(first_purchase="min", last_purchase="max")
    movement = movement.join(customer_dates, on="customer")
    movement["days_since_last_purchase"] = (
        window.current_end - movement["last_purchase"].dt.normalize()
    ).dt.days

    starting_revenue = float(movement["previous_revenue"].sum())
    new_revenue = float(movement.loc[movement["status"].eq("new"), "current_revenue"].sum())
    expansion = float(movement.loc[movement["status"].eq("expanded"), "revenue_delta"].sum())
    contraction = float(-movement.loc[movement["status"].eq("contracted"), "revenue_delta"].sum())
    lost_revenue = float(movement.loc[movement["status"].eq("lost"), "previous_revenue"].sum())
    ending_revenue = float(movement["current_revenue"].sum())

    bridge = pd.DataFrame(
        {
            "component": [
                "Starting revenue",
                "New customer revenue",
                "Expansion",
                "Contraction",
                "Lost customer revenue",
                "Ending revenue",
            ],
            "value": [
                starting_revenue,
                new_revenue,
                expansion,
                -contraction,
                -lost_revenue,
                ending_revenue,
            ],
            "kind": ["total", "increase", "increase", "decrease", "decrease", "total"],
        }
    )

    movement = movement.sort_values(
        ["status", "revenue_delta"],
        ascending=[True, False],
    ).reset_index(drop=True)
    return movement, bridge, window


def build_rfm_segments(data: pd.DataFrame) -> pd.DataFrame:
    _validate(data)
    as_of = pd.Timestamp(data["date"].max()).normalize() + pd.Timedelta(days=1)

    customers = (
        data.groupby("customer", as_index=False)
        .agg(
            first_purchase=("date", "min"),
            last_purchase=("date", "max"),
            transactions=("revenue", "size"),
            active_months=("date", lambda values: values.dt.to_period("M").nunique()),
            revenue=("revenue", "sum"),
            profit=("profit", "sum"),
            average_order=("revenue", "mean"),
        )
    )
    customers["recency_days"] = (
        as_of - customers["last_purchase"].dt.normalize()
    ).dt.days
    customers["margin"] = customers["profit"].div(
        customers["revenue"].where(customers["revenue"].ne(0))
    )

    customers["r_score"] = _pct_rank_score(
        customers["recency_days"],
        higher_is_better=False,
    )
    customers["f_score"] = _pct_rank_score(
        customers["transactions"],
        higher_is_better=True,
    )
    customers["m_score"] = _pct_rank_score(
        customers["revenue"],
        higher_is_better=True,
    )
    customers["rfm_score"] = (
        customers["r_score"] * 100
        + customers["f_score"] * 10
        + customers["m_score"]
    )

    def segment(row: pd.Series) -> str:
        r, f, m = int(row["r_score"]), int(row["f_score"]), int(row["m_score"])
        if r >= 4 and f >= 4 and m >= 4:
            return "Champions"
        if r >= 3 and f >= 4:
            return "Loyal"
        if r >= 3 and m >= 4:
            return "High value"
        if r >= 4 and f <= 2:
            return "New"
        if r <= 2 and (f >= 3 or m >= 3):
            return "At risk"
        if r <= 2 and f <= 2:
            return "Hibernating"
        if r >= 3:
            return "Promising"
        return "Needs attention"

    customers["segment"] = customers.apply(segment, axis=1)
    return customers.sort_values(
        ["segment", "revenue"],
        ascending=[True, False],
    ).reset_index(drop=True)



def build_customer_cadence(data: pd.DataFrame) -> pd.DataFrame:
    """
    Learn each customer's normal buying interval and flag overdue accounts.

    Cadence is calculated from distinct purchase dates, so multiple line items on
    one day do not artificially shorten the expected repurchase interval.
    """
    _validate(data)
    as_of = pd.Timestamp(data["date"].max()).normalize() + pd.Timedelta(days=1)
    rows: list[dict[str, object]] = []

    for customer, group in data.groupby("customer"):
        purchase_dates = (
            group["date"].dt.normalize().drop_duplicates().sort_values().reset_index(drop=True)
        )
        if len(purchase_dates) < 3:
            continue

        intervals = purchase_dates.diff().dt.days.dropna()
        intervals = intervals.loc[intervals.gt(0)]
        if intervals.empty:
            continue

        median_interval = float(intervals.median())
        interval_mad = float((intervals - median_interval).abs().median())
        last_purchase = pd.Timestamp(purchase_dates.iloc[-1])
        expected_next_purchase = last_purchase + pd.Timedelta(days=median_interval)
        days_overdue = max(0, int((as_of - expected_next_purchase).days))
        overdue_ratio = days_overdue / median_interval if median_interval > 0 else 0.0
        median_order = float(group["revenue"].median())
        historical_revenue = float(group["revenue"].sum())
        confidence = min(1.0, len(intervals) / 5)

        if overdue_ratio >= 1.0:
            cadence_status = "Severely overdue"
        elif overdue_ratio >= 0.25:
            cadence_status = "Overdue"
        elif (expected_next_purchase - as_of).days <= max(7, int(median_interval * 0.20)):
            cadence_status = "Due soon"
        else:
            cadence_status = "On schedule"

        rows.append(
            {
                "customer": customer,
                "purchase_dates": int(len(purchase_dates)),
                "median_interval_days": median_interval,
                "interval_mad_days": interval_mad,
                "last_purchase": last_purchase,
                "expected_next_purchase": expected_next_purchase,
                "days_overdue": days_overdue,
                "overdue_ratio": overdue_ratio,
                "cadence_status": cadence_status,
                "median_order": median_order,
                "historical_revenue": historical_revenue,
                "estimated_revenue_at_risk": median_order if days_overdue > 0 else 0.0,
                "confidence": confidence,
            }
        )

    columns = [
        "customer",
        "purchase_dates",
        "median_interval_days",
        "interval_mad_days",
        "last_purchase",
        "expected_next_purchase",
        "days_overdue",
        "overdue_ratio",
        "cadence_status",
        "median_order",
        "historical_revenue",
        "estimated_revenue_at_risk",
        "confidence",
    ]
    if not rows:
        return pd.DataFrame(columns=columns)

    return pd.DataFrame(rows, columns=columns).sort_values(
        ["days_overdue", "estimated_revenue_at_risk"],
        ascending=[False, False],
    ).reset_index(drop=True)


def build_cross_sell_opportunities(
    data: pd.DataFrame,
    *,
    minimum_source_customers: int = 3,
    minimum_joint_customers: int = 2,
) -> pd.DataFrame:
    """
    Find product whitespace using directional product affinity.

    Estimated opportunity is intentionally conservative: eligible customers ×
    median target-product revenue × min(observed confidence, 25%).
    """
    _validate(data)
    if minimum_source_customers < 2 or minimum_joint_customers < 1:
        raise ValueError("Cross-sell support thresholds are invalid.")

    customer_products = (
        data[["customer", "product"]]
        .drop_duplicates()
        .assign(purchased=True)
        .pivot(index="customer", columns="product", values="purchased")
        .notna()
    )
    total_customers = len(customer_products)
    if total_customers == 0 or customer_products.shape[1] < 2:
        return pd.DataFrame()

    revenue_per_customer_product = data.groupby(["customer", "product"])["revenue"].sum()
    opportunities: list[dict[str, object]] = []

    for source_product in customer_products.columns:
        source_mask = customer_products[source_product]
        source_customers = int(source_mask.sum())
        if source_customers < minimum_source_customers:
            continue

        for target_product in customer_products.columns:
            if source_product == target_product:
                continue

            target_mask = customer_products[target_product]
            joint_customers = int((source_mask & target_mask).sum())
            if joint_customers < minimum_joint_customers:
                continue

            target_customers = int(target_mask.sum())
            eligible_mask = source_mask & ~target_mask
            eligible_customers = int(eligible_mask.sum())
            if eligible_customers == 0:
                continue

            confidence = joint_customers / source_customers
            target_prevalence = target_customers / total_customers
            lift = confidence / target_prevalence if target_prevalence > 0 else 0.0

            target_values = revenue_per_customer_product.xs(
                target_product,
                level="product",
                drop_level=False,
            )
            median_target_revenue = float(target_values.median())
            modeled_conversion = min(confidence, 0.25)
            estimated_opportunity = (
                eligible_customers * median_target_revenue * modeled_conversion
            )

            eligible_names = customer_products.index[eligible_mask].astype(str).tolist()
            opportunities.append(
                {
                    "source_product": source_product,
                    "target_product": target_product,
                    "source_customers": source_customers,
                    "joint_customers": joint_customers,
                    "eligible_customers": eligible_customers,
                    "confidence": confidence,
                    "lift": lift,
                    "median_target_revenue": median_target_revenue,
                    "modeled_conversion": modeled_conversion,
                    "estimated_opportunity": estimated_opportunity,
                    "eligible_customer_examples": ", ".join(eligible_names[:5]),
                }
            )

    if not opportunities:
        return pd.DataFrame(
            columns=[
                "source_product",
                "target_product",
                "source_customers",
                "joint_customers",
                "eligible_customers",
                "confidence",
                "lift",
                "median_target_revenue",
                "modeled_conversion",
                "estimated_opportunity",
                "eligible_customer_examples",
            ]
        )

    return pd.DataFrame(opportunities).sort_values(
        ["estimated_opportunity", "lift", "confidence"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

def build_product_momentum(
    data: pd.DataFrame,
    *,
    days: int = 30,
) -> pd.DataFrame:
    _validate(data)
    window = rolling_period_window(data, days=days)

    current = data.loc[data["date"].between(window.current_start, window.current_end)]
    previous = data.loc[data["date"].between(window.previous_start, window.previous_end)]

    def summarize(frame: pd.DataFrame, prefix: str) -> pd.DataFrame:
        if frame.empty:
            return pd.DataFrame()
        summary = frame.groupby("product").agg(
            revenue=("revenue", "sum"),
            profit=("profit", "sum"),
            customers=("customer", "nunique"),
            transactions=("revenue", "size"),
        )
        summary["margin"] = summary["profit"].div(summary["revenue"].where(summary["revenue"].ne(0)))
        return summary.add_prefix(f"{prefix}_")

    products = pd.concat(
        [summarize(previous, "previous"), summarize(current, "current")],
        axis=1,
    ).fillna(0.0)
    if products.empty:
        return pd.DataFrame(
            columns=[
                "product",
                "previous_revenue",
                "current_revenue",
                "revenue_delta",
                "revenue_growth",
                "previous_profit",
                "current_profit",
                "profit_delta",
                "previous_margin",
                "current_margin",
                "margin_delta",
                "signal",
            ]
        )

    products = products.reset_index()
    products["revenue_delta"] = products["current_revenue"] - products["previous_revenue"]
    products["profit_delta"] = products["current_profit"] - products["previous_profit"]
    products["margin_delta"] = products["current_margin"] - products["previous_margin"]
    products["revenue_growth"] = products["revenue_delta"].div(
        products["previous_revenue"].where(products["previous_revenue"].ne(0))
    )

    positive_current = products.loc[products["current_revenue"].gt(0), "current_revenue"]
    high_revenue_threshold = float(positive_current.quantile(0.75)) if not positive_current.empty else 0.0

    products["signal"] = "Monitor"
    products.loc[
        products["previous_revenue"].eq(0) & products["current_revenue"].gt(0),
        "signal",
    ] = "New product revenue"
    products.loc[
        products["revenue_growth"].ge(0.20)
        & products["profit_delta"].ge(0)
        & products["current_revenue"].ge(high_revenue_threshold),
        "signal",
    ] = "Breakout"
    products.loc[
        products["revenue_delta"].gt(0)
        & (
            products["profit_delta"].lt(0)
            | products["margin_delta"].lt(-0.05)
        ),
        "signal",
    ] = "Margin leakage"
    products.loc[
        products["revenue_growth"].le(-0.20),
        "signal",
    ] = "Declining"
    products.loc[
        products["current_revenue"].ge(high_revenue_threshold)
        & products["revenue_growth"].between(-0.20, 0.20, inclusive="both")
        & products["margin_delta"].ge(-0.05),
        "signal",
    ] = "Core"

    return products.sort_values("current_revenue", ascending=False).reset_index(drop=True)


def calculate_revenue_resilience(data: pd.DataFrame) -> RevenueResilience:
    _validate(data)
    customer_revenue = data.groupby("customer")["revenue"].sum().clip(lower=0)
    total_revenue = float(customer_revenue.sum())
    shares = customer_revenue.div(total_revenue) if total_revenue else customer_revenue * 0

    top_customer_share = float(shares.max()) if not shares.empty else 0.0
    top_five_customer_share = float(shares.nlargest(5).sum()) if not shares.empty else 0.0
    hhi = float((shares**2).sum()) if not shares.empty else 0.0
    effective_customer_count = (1.0 / hhi) if hhi > 0 else 0.0

    order_counts = data.groupby("customer").size()
    repeating_customers = order_counts[order_counts.gt(1)].index
    repeat_revenue = float(
        data.loc[data["customer"].isin(repeating_customers), "revenue"].sum()
    )
    repeatability = _safe_divide(repeat_revenue, float(data["revenue"].sum())) or 0.0

    monthly = (
        data.assign(month=data["date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)
        .agg(revenue=("revenue", "sum"), profit=("profit", "sum"))
    )
    monthly_revenue_mean = float(monthly["revenue"].mean()) if not monthly.empty else 0.0
    monthly_revenue_cv = (
        float(monthly["revenue"].std(ddof=0) / abs(monthly_revenue_mean))
        if len(monthly) >= 2 and monthly_revenue_mean != 0
        else None
    )

    monthly["margin"] = monthly["profit"].div(monthly["revenue"].where(monthly["revenue"].ne(0)))
    valid_margins = monthly["margin"].dropna()
    margin_consistency_score: float | None
    if len(valid_margins) >= 2:
        margin_variation = float(valid_margins.std(ddof=0))
        margin_consistency_score = max(0.0, 100.0 * (1.0 - min(margin_variation / 0.20, 1.0)))
    else:
        margin_consistency_score = None

    concentration_score = 100.0 * min(log1p(effective_customer_count) / log1p(20), 1.0)
    repeatability_score = 100.0 * max(0.0, min(repeatability, 1.0))
    stability_score = (
        50.0
        if monthly_revenue_cv is None
        else 100.0 * (1.0 - min(monthly_revenue_cv / 1.5, 1.0))
    )

    components = [
        (concentration_score, 0.40),
        (repeatability_score, 0.35),
        (stability_score, 0.25),
    ]
    if margin_consistency_score is not None:
        components = [
            (concentration_score, 0.35),
            (repeatability_score, 0.30),
            (stability_score, 0.20),
            (margin_consistency_score, 0.15),
        ]

    score = sum(value * weight for value, weight in components)
    months = int(data["date"].dt.to_period("M").nunique())
    confidence = min(1.0, 0.55 * min(months / 12, 1.0) + 0.45 * min(len(data) / 500, 1.0))

    return RevenueResilience(
        score=round(score, 1),
        confidence=round(confidence, 2),
        concentration_score=round(concentration_score, 1),
        repeatability_score=round(repeatability_score, 1),
        stability_score=round(stability_score, 1),
        margin_consistency_score=(
            round(margin_consistency_score, 1)
            if margin_consistency_score is not None
            else None
        ),
        top_customer_share=top_customer_share,
        top_five_customer_share=top_five_customer_share,
        hhi=hhi,
        effective_customer_count=effective_customer_count,
        gini=_gini(customer_revenue),
        monthly_revenue_cv=monthly_revenue_cv,
    )


def build_decision_queue(
    data: pd.DataFrame,
    *,
    customer_movement: pd.DataFrame,
    rfm: pd.DataFrame,
    cadence: pd.DataFrame,
    cross_sell: pd.DataFrame,
    products: pd.DataFrame,
    resilience: RevenueResilience,
) -> pd.DataFrame:
    _validate(data)
    insights: list[DecisionInsight] = []
    total_revenue = float(data["revenue"].sum())

    def impact_share(amount: float | None) -> float | None:
        if amount is None or total_revenue == 0:
            return None
        return abs(amount) / abs(total_revenue)

    if resilience.top_customer_share >= 0.25:
        customer_totals = data.groupby("customer")["revenue"].sum().sort_values(ascending=False)
        top_customer = str(customer_totals.index[0])
        exposure = float(customer_totals.iloc[0])
        insights.append(
            DecisionInsight(
                insight_id="customer-concentration",
                priority="critical" if resilience.top_customer_share >= 0.40 else "high",
                category="Risk",
                title=f"Revenue is concentrated in {top_customer}",
                summary=(
                    f"The largest customer contributes {resilience.top_customer_share:.1%} "
                    "of all observed revenue, creating material dependency risk."
                ),
                recommended_action=(
                    "Create a retention plan for this account and set a diversification target "
                    "for the next reporting period."
                ),
                impact_amount=exposure,
                impact_share=impact_share(exposure),
                confidence=resilience.confidence,
                evidence=(
                    f"Top-customer share={resilience.top_customer_share:.1%}; "
                    f"effective customer count={resilience.effective_customer_count:.1f}."
                ),
            )
        )

    lost_revenue = float(
        customer_movement.loc[customer_movement["status"].eq("lost"), "previous_revenue"].sum()
    )
    lost_count = int(customer_movement["status"].eq("lost").sum())
    if lost_revenue > 0:
        insights.append(
            DecisionInsight(
                insight_id="lost-customer-revenue",
                priority="high" if impact_share(lost_revenue) and impact_share(lost_revenue) >= 0.10 else "medium",
                category="Retention",
                title=f"{lost_count} customer(s) stopped contributing revenue",
                summary=(
                    f"Customers present in the previous comparison window but absent in the latest "
                    f"window represent ${lost_revenue:,.0f} of lost period revenue."
                ),
                recommended_action=(
                    "Review the lost-customer list, validate whether the lapse is expected, and launch "
                    "targeted win-back outreach for the highest-value accounts."
                ),
                impact_amount=lost_revenue,
                impact_share=impact_share(lost_revenue),
                confidence=0.90,
                evidence=f"{lost_count} lost customers in the rolling-period bridge.",
            )
        )

    at_risk = rfm.loc[rfm["segment"].eq("At risk")].copy()
    if not at_risk.empty:
        exposure = float(at_risk["revenue"].sum())
        insights.append(
            DecisionInsight(
                insight_id="rfm-at-risk",
                priority="high" if impact_share(exposure) and impact_share(exposure) >= 0.15 else "medium",
                category="Retention",
                title=f"{len(at_risk)} historically valuable customer(s) are at risk",
                summary=(
                    "These customers rank poorly on recency but above average on frequency or value. "
                    f"Their observed revenue totals ${exposure:,.0f}."
                ),
                recommended_action=(
                    "Prioritize outreach by revenue, starting with accounts that have the largest gap "
                    "since their last purchase."
                ),
                impact_amount=exposure,
                impact_share=impact_share(exposure),
                confidence=0.82,
                evidence="RFM segmentation: low recency score with strong frequency or monetary score.",
            )
        )

    overdue = cadence.loc[
        cadence["cadence_status"].isin(["Overdue", "Severely overdue"])
        & cadence["confidence"].ge(0.40)
    ].copy()
    if not overdue.empty:
        exposure = float(overdue["estimated_revenue_at_risk"].sum())
        names = ", ".join(overdue.head(3)["customer"].astype(str))
        weighted_confidence = float(
            overdue["confidence"].mul(overdue["estimated_revenue_at_risk"]).sum()
            / max(overdue["estimated_revenue_at_risk"].sum(), 1.0)
        )
        insights.append(
            DecisionInsight(
                insight_id="cadence-overdue",
                priority="high" if impact_share(exposure) and impact_share(exposure) >= 0.05 else "medium",
                category="Retention",
                title="Customers are late relative to their own buying cadence",
                summary=(
                    f"{len(overdue)} repeat customer(s) are overdue based on their personal "
                    f"purchase intervals, with approximately ${exposure:,.0f} of expected order value at risk."
                ),
                recommended_action=(
                    "Contact the most overdue accounts first and reference their usual purchase cycle "
                    "rather than using a generic inactivity threshold."
                ),
                impact_amount=exposure,
                impact_share=impact_share(exposure),
                confidence=min(0.95, weighted_confidence),
                evidence=f"Most overdue accounts include: {names}.",
            )
        )

    if not cross_sell.empty:
        top_opportunity = cross_sell.iloc[0]
        opportunity = float(top_opportunity["estimated_opportunity"])
        if opportunity > 0:
            insights.append(
                DecisionInsight(
                    insight_id="cross-sell-whitespace",
                    priority="opportunity",
                    category="Growth",
                    title=(
                        f"Cross-sell {top_opportunity['target_product']} to "
                        f"{int(top_opportunity['eligible_customers'])} customer(s)"
                    ),
                    summary=(
                        f"Customers buying {top_opportunity['source_product']} also buy "
                        f"{top_opportunity['target_product']} at {top_opportunity['confidence']:.1%} "
                        f"confidence and {top_opportunity['lift']:.2f}× lift."
                    ),
                    recommended_action=(
                        "Review the eligible customer list and test a targeted bundle or outreach campaign."
                    ),
                    impact_amount=opportunity,
                    impact_share=impact_share(opportunity),
                    confidence=min(0.90, float(top_opportunity["confidence"])),
                    evidence=(
                        f"Conservative model uses {top_opportunity['modeled_conversion']:.1%} conversion "
                        f"and median target revenue of ${top_opportunity['median_target_revenue']:,.0f}."
                    ),
                )
            )

    leakage = products.loc[products["signal"].eq("Margin leakage")].copy()
    if not leakage.empty:
        leakage["profit_gap"] = (
            leakage["previous_margin"] * leakage["current_revenue"]
            - leakage["current_profit"]
        ).clip(lower=0)
        exposure = float(leakage["profit_gap"].sum())
        names = ", ".join(leakage.head(3)["product"].astype(str))
        insights.append(
            DecisionInsight(
                insight_id="margin-leakage",
                priority="high" if exposure > 0 else "medium",
                category="Profitability",
                title="Revenue growth is not translating into profit",
                summary=(
                    f"{len(leakage)} product(s) grew revenue while profit or margin weakened. "
                    f"Estimated profit gap versus prior margins is ${exposure:,.0f}."
                ),
                recommended_action=(
                    "Inspect pricing, discounting, delivery cost, and product mix for the flagged products."
                ),
                impact_amount=exposure,
                impact_share=impact_share(exposure),
                confidence=0.88,
                evidence=f"Flagged products include: {names}.",
            )
        )

    breakout = products.loc[products["signal"].eq("Breakout")].copy()
    if not breakout.empty:
        upside = float(breakout["revenue_delta"].clip(lower=0).sum())
        names = ", ".join(breakout.head(3)["product"].astype(str))
        insights.append(
            DecisionInsight(
                insight_id="breakout-products",
                priority="opportunity",
                category="Growth",
                title="Breakout products are creating profitable growth",
                summary=(
                    f"{len(breakout)} product(s) combined strong revenue growth with stable or improving profit."
                ),
                recommended_action=(
                    "Protect capacity and test whether the winning offer can be expanded to similar customers."
                ),
                impact_amount=upside,
                impact_share=impact_share(upside),
                confidence=0.80,
                evidence=f"Breakout products include: {names}.",
            )
        )

    if not insights:
        insights.append(
            DecisionInsight(
                insight_id="no-material-exceptions",
                priority="info",
                category="Monitoring",
                title="No material decision exceptions were detected",
                summary=(
                    "The current rules did not find large concentration, retention, margin, or product momentum exceptions."
                ),
                recommended_action="Continue monitoring as additional periods and transactions become available.",
                impact_amount=None,
                impact_share=None,
                confidence=resilience.confidence,
                evidence="Deterministic decision rules evaluated the available transaction history.",
            )
        )

    priority_order = {
        "critical": 0,
        "high": 1,
        "medium": 2,
        "opportunity": 3,
        "info": 4,
    }
    queue = pd.DataFrame(asdict(item) for item in insights)
    queue["priority_rank"] = queue["priority"].map(priority_order)
    queue["decision_score"] = (
        queue["impact_amount"].abs().fillna(0.0)
        * queue["confidence"].fillna(0.0)
    )
    return queue.sort_values(
        ["priority_rank", "decision_score"],
        ascending=[True, False],
    ).drop(columns=["priority_rank"]).reset_index(drop=True)


def build_advanced_analytics(
    data: pd.DataFrame,
    *,
    comparison_days: int = 30,
) -> dict[str, object]:
    """Build all deterministic, explainable decision-intelligence outputs."""
    _validate(data)
    customer_movement, revenue_bridge, period_window = build_customer_movement(
        data,
        days=comparison_days,
    )
    rfm = build_rfm_segments(data)
    cadence = build_customer_cadence(data)
    cross_sell = build_cross_sell_opportunities(data)
    products = build_product_momentum(data, days=comparison_days)
    resilience = calculate_revenue_resilience(data)
    decision_queue = build_decision_queue(
        data,
        customer_movement=customer_movement,
        rfm=rfm,
        cadence=cadence,
        cross_sell=cross_sell,
        products=products,
        resilience=resilience,
    )

    return {
        "period_window": period_window,
        "customer_movement": customer_movement,
        "revenue_bridge": revenue_bridge,
        "rfm": rfm,
        "customer_cadence": cadence,
        "cross_sell": cross_sell,
        "product_momentum": products,
        "resilience": resilience,
        "decision_queue": decision_queue,
    }
