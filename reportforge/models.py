from dataclasses import dataclass


@dataclass(frozen=True)
class ColumnMapping:
    date: str
    customer: str
    product: str
    revenue: str
    cost: str | None = None


@dataclass(frozen=True)
class SalesMetrics:
    total_revenue: float
    total_cost: float
    gross_profit: float
    gross_margin: float | None

    transaction_count: int
    average_order_value: float
    median_order_value: float

    unique_customers: int
    unique_products: int
    repeat_customer_rate: float

    top_customer_share: float
    top_product_share: float

    revenue_growth: float | None
    profit_growth: float | None

    anomaly_count: int