import pandas as pd
import pytest

from reportforge.advanced_analytics import (
    build_advanced_analytics,
    build_cross_sell_opportunities,
    build_customer_cadence,
    build_customer_movement,
    build_rfm_segments,
    calculate_revenue_resilience,
)


def sample_data() -> pd.DataFrame:
    rows = [
        ("2026-01-02", "Acme", "Audit", 1000, 600),
        ("2026-01-10", "Beta", "Setup", 500, 250),
        ("2026-01-20", "Acme", "Support", 300, 120),
        ("2026-02-05", "Acme", "Audit", 1400, 750),
        ("2026-02-12", "Gamma", "Setup", 800, 300),
        ("2026-02-20", "Gamma", "Audit", 900, 420),
        ("2026-03-05", "Acme", "Audit", 1800, 1100),
        ("2026-03-10", "Gamma", "Setup", 1000, 550),
        ("2026-03-20", "Delta", "Support", 700, 200),
    ]
    frame = pd.DataFrame(rows, columns=["date", "customer", "product", "revenue", "cost"])
    frame["date"] = pd.to_datetime(frame["date"])
    frame["profit"] = frame["revenue"] - frame["cost"]
    return frame


def test_customer_movement_bridge_reconciles() -> None:
    movement, bridge, _ = build_customer_movement(sample_data(), days=30)

    starting = float(bridge.loc[bridge["component"].eq("Starting revenue"), "value"].iloc[0])
    ending = float(bridge.loc[bridge["component"].eq("Ending revenue"), "value"].iloc[0])
    changes = float(
        bridge.loc[
            ~bridge["component"].isin(["Starting revenue", "Ending revenue"]),
            "value",
        ].sum()
    )

    assert starting + changes == pytest.approx(ending)
    assert {"new", "lost", "expanded", "contracted", "unchanged"}.intersection(
        set(movement["status"])
    )


def test_rfm_segments_are_scored_and_labeled() -> None:
    rfm = build_rfm_segments(sample_data())

    assert set(rfm["r_score"]).issubset({1, 2, 3, 4, 5})
    assert set(rfm["f_score"]).issubset({1, 2, 3, 4, 5})
    assert set(rfm["m_score"]).issubset({1, 2, 3, 4, 5})
    assert rfm["segment"].notna().all()


def test_resilience_metrics_are_bounded() -> None:
    resilience = calculate_revenue_resilience(sample_data())

    assert 0 <= resilience.score <= 100
    assert 0 <= resilience.confidence <= 1
    assert 0 <= resilience.top_customer_share <= 1
    assert resilience.effective_customer_count >= 1


def test_advanced_analytics_contains_actionable_outputs() -> None:
    advanced = build_advanced_analytics(sample_data(), comparison_days=30)

    assert not advanced["decision_queue"].empty
    assert not advanced["revenue_bridge"].empty
    assert not advanced["rfm"].empty
    assert "recommended_action" in advanced["decision_queue"].columns
    assert "evidence" in advanced["decision_queue"].columns



def test_customer_cadence_flags_overdue_accounts() -> None:
    frame = sample_data()
    cadence = build_customer_cadence(frame)

    assert "Acme" in set(cadence["customer"])
    assert set(cadence["cadence_status"]).issubset(
        {"On schedule", "Due soon", "Overdue", "Severely overdue"}
    )
    assert cadence["confidence"].between(0, 1).all()


def test_cross_sell_opportunities_are_directional_and_bounded() -> None:
    frame = pd.DataFrame(
        [
            ("2026-01-01", "A", "Core", 100, 40),
            ("2026-01-02", "A", "Add-on", 50, 20),
            ("2026-01-03", "B", "Core", 100, 40),
            ("2026-01-04", "B", "Add-on", 60, 25),
            ("2026-01-05", "C", "Core", 120, 50),
            ("2026-01-06", "D", "Core", 90, 35),
            ("2026-01-07", "D", "Add-on", 55, 20),
        ],
        columns=["date", "customer", "product", "revenue", "cost"],
    )
    frame["date"] = pd.to_datetime(frame["date"])
    frame["profit"] = frame["revenue"] - frame["cost"]

    opportunities = build_cross_sell_opportunities(frame)

    top = opportunities.iloc[0]
    assert top["source_product"] == "Core"
    assert top["target_product"] == "Add-on"
    assert top["eligible_customers"] == 1
    assert 0 <= top["modeled_conversion"] <= 0.25
    assert top["estimated_opportunity"] > 0
