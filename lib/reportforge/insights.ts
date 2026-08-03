import type {
    CleaningSummary,
    CustomerMovementResult,
    DecisionAction,
    ProductMomentumResult,
    RfmResult,
    SalesMetrics,
} from "./types";

function money(
    value: number,
): string {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        },
    ).format(value);
}

function percent(
    value: number,
): string {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "percent",
            maximumFractionDigits: 1,
        },
    ).format(value);
}

function priorityWeight(
    priority:
    DecisionAction["priority"],
): number {
    switch (priority) {
        case "critical":
            return 4;

        case "high":
            return 3;

        case "medium":
            return 2;

        case "low":
            return 1;
    }
}

export function buildDecisionQueue({
                                       metrics,
                                       cleaning,
                                       productMomentum,
                                       customerMovement,
                                       rfm,
                                   }: {
    metrics: SalesMetrics;
    cleaning: CleaningSummary;
    productMomentum:
        ProductMomentumResult;
    customerMovement:
        CustomerMovementResult;
    rfm: RfmResult;
}): DecisionAction[] {
    const actions:
        DecisionAction[] = [];

    const topLostCustomer =
        customerMovement
            .lostCustomers[0];

    if (
        topLostCustomer &&
        topLostCustomer
            .previousRevenue > 0
    ) {
        actions.push({
            id: "recover-largest-lost-customer",
            priority: "critical",
            category: "customer",

            title:
                "Recover a high-value lost customer",

            summary:
                `${topLostCustomer.customer} generated ` +
                `${money(
                    topLostCustomer.previousRevenue,
                )} in the previous comparison window ` +
                "and no revenue in the current window.",

            recommendation:
                "Review the account immediately, identify the reason activity stopped, and assign a direct reactivation outreach.",

            evidence: [
                `Previous revenue: ${money(
                    topLostCustomer.previousRevenue,
                )}`,
                `Previous orders: ${topLostCustomer.previousOrders.toLocaleString()}`,
                `Last purchase: ${new Date(
                    topLostCustomer.lastPurchase,
                ).toLocaleDateString()}`,
            ],

            estimatedImpact:
            topLostCustomer
                .previousRevenue,
        });
    }

    const totalLostRevenue =
        customerMovement
            .totals.lostRevenue;

    if (totalLostRevenue > 0) {
        actions.push({
            id: "customer-churn-recovery",
            priority:
                totalLostRevenue >
                metrics.totalRevenue *
                0.1
                    ? "critical"
                    : "high",

            category: "customer",

            title:
                "Launch a customer recovery campaign",

            summary:
                `${money(
                    totalLostRevenue,
                )} of prior-period customer revenue ` +
                "did not return in the current comparison window.",

            recommendation:
                "Group lost customers by prior value, last purchase date, and purchased products. Prioritize the highest-value accounts first.",

            evidence: [
                `${customerMovement.lostCustomers.length.toLocaleString()} high-value lost customers are listed`,
                `Lost revenue: ${money(
                    totalLostRevenue,
                )}`,
            ],

            estimatedImpact:
            totalLostRevenue,
        });
    }

    const topContracted =
        customerMovement
            .contractedCustomers[0];

    if (
        topContracted &&
        topContracted
            .revenueChange < 0
    ) {
        actions.push({
            id: "largest-customer-contraction",
            priority: "high",
            category: "customer",

            title:
                "Investigate the largest customer contraction",

            summary:
                `${topContracted.customer} declined by ` +
                `${money(
                    Math.abs(
                        topContracted.revenueChange,
                    ),
                )} compared with the prior window.`,

            recommendation:
                "Compare product mix and order frequency, then contact the account before the contraction becomes full churn.",

            evidence: [
                `Current revenue: ${money(
                    topContracted.currentRevenue,
                )}`,
                `Previous revenue: ${money(
                    topContracted.previousRevenue,
                )}`,
                `Current orders: ${topContracted.currentOrders.toLocaleString()}`,
                `Previous orders: ${topContracted.previousOrders.toLocaleString()}`,
            ],

            estimatedImpact:
                Math.abs(
                    topContracted.revenueChange,
                ),
        });
    }

    const topDecliningProduct =
        productMomentum
            .fastestDeclining[0];

    if (
        topDecliningProduct &&
        topDecliningProduct
            .revenueChange < 0
    ) {
        actions.push({
            id: "largest-product-decline",
            priority: "high",
            category: "product",

            title:
                "Review the fastest-declining product",

            summary:
                `${topDecliningProduct.product} lost ` +
                `${money(
                    Math.abs(
                        topDecliningProduct.revenueChange,
                    ),
                )} between the comparison windows.`,

            recommendation:
                "Check inventory, pricing, placement, customer demand, and return activity before deciding whether to promote, reposition, or retire the product.",

            evidence: [
                `Current revenue: ${money(
                    topDecliningProduct.currentRevenue,
                )}`,
                `Previous revenue: ${money(
                    topDecliningProduct.previousRevenue,
                )}`,
                `Current orders: ${topDecliningProduct.currentOrders.toLocaleString()}`,
                `Previous orders: ${topDecliningProduct.previousOrders.toLocaleString()}`,
            ],

            estimatedImpact:
                Math.abs(
                    topDecliningProduct.revenueChange,
                ),
        });
    }

    const returnAlertCandidates =
        productMomentum.products
            .filter((product) => {
                const qualifiesForReturnAlert =
                    product.currentSalesRevenue >=
                    500 &&
                    product.currentOrders >= 5 &&
                    product.currentReturnedRevenue >=
                    100 &&
                    product.currentReturnRate !==
                    null &&
                    product.currentReturnRate >=
                    0.1;

                return qualifiesForReturnAlert;
            })
            .sort(
                (left, right) => {
                    /*
                     * Prioritize financial impact first,
                     * then return rate.
                     */
                    const impactDifference =
                        right.currentReturnedRevenue -
                        left.currentReturnedRevenue;

                    if (
                        impactDifference !== 0
                    ) {
                        return impactDifference;
                    }

                    return (
                        (right.currentReturnRate ??
                            0) -
                        (left.currentReturnRate ??
                            0)
                    );
                },
            );

    const highestReturnProduct =
        returnAlertCandidates[0];

    if (
        highestReturnProduct &&
        highestReturnProduct.currentReturnRate !==
        null
    ) {
        const returnRate =
            highestReturnProduct.currentReturnRate;

        const returnedRevenue =
            highestReturnProduct
                .currentReturnedRevenue;

        const priority:
            DecisionAction["priority"] =
            returnedRevenue >= 10_000 ||
            (
                returnRate >= 0.25 &&
                returnedRevenue >= 2_500
            )
                ? "critical"
                : returnedRevenue >= 1_000 ||
                returnRate >= 0.2
                    ? "high"
                    : "medium";

        actions.push({
            id: "product-return-problem",
            priority,
            category: "returns",

            title:
                "Review a high-impact product return issue",

            summary:
                `${highestReturnProduct.product} has ` +
                `${money(
                    returnedRevenue,
                )} in returned revenue, representing ` +
                `${percent(
                    returnRate,
                )} of positive sales in the current comparison window.`,

            recommendation:
                "Review product quality, description accuracy, packaging, fulfillment, and customer feedback. Prioritize fixes based on the financial impact of the returns.",

            evidence: [
                `Positive sales: ${money(
                    highestReturnProduct.currentSalesRevenue,
                )}`,

                `Returned revenue: ${money(
                    returnedRevenue,
                )}`,

                `Orders: ${highestReturnProduct.currentOrders.toLocaleString()}`,

                `Return rate: ${percent(
                    returnRate,
                )}`,
            ],

            estimatedImpact:
            returnedRevenue,
        });
    }

    const topGrowingProduct =
        productMomentum
            .fastestGrowing[0];

    if (
        topGrowingProduct &&
        topGrowingProduct
            .revenueChange > 0
    ) {
        actions.push({
            id: "scale-growing-product",
            priority: "medium",
            category: "growth",

            title:
                "Scale the strongest growing product",

            summary:
                `${topGrowingProduct.product} added ` +
                `${money(
                    topGrowingProduct.revenueChange,
                )} compared with the prior window.`,

            recommendation:
                "Confirm inventory capacity, maintain availability, and test additional promotion or bundling while demand is rising.",

            evidence: [
                `Current revenue: ${money(
                    topGrowingProduct.currentRevenue,
                )}`,
                `Growth: ${
                    topGrowingProduct.revenueChangeRate ===
                    null
                        ? "New activity"
                        : percent(
                            topGrowingProduct.revenueChangeRate,
                        )
                }`,
                `Current customers: ${topGrowingProduct.currentCustomers.toLocaleString()}`,
            ],

            estimatedImpact:
            topGrowingProduct
                .revenueChange,
        });
    }

    if (
        metrics.topCustomerShare >=
        0.2
    ) {
        actions.push({
            id: "customer-concentration-risk",
            priority:
                metrics.topCustomerShare >=
                0.35
                    ? "critical"
                    : "high",

            category:
                "concentration",

            title:
                "Reduce dependence on the largest customer",

            summary:
                `The largest customer represents ${percent(
                    metrics.topCustomerShare,
                )} of customer-attributed revenue.`,

            recommendation:
                "Protect the key account while building additional revenue sources through acquisition and expansion of mid-sized customers.",

            evidence: [
                `Top customer share: ${percent(
                    metrics.topCustomerShare,
                )}`,
                `Known customers: ${metrics.uniqueCustomers.toLocaleString()}`,
            ],

            estimatedImpact:
                metrics.totalRevenue *
                metrics.topCustomerShare,
        });
    }

    if (
        metrics.topProductShare >=
        0.2
    ) {
        actions.push({
            id: "product-concentration-risk",
            priority: "high",
            category:
                "concentration",

            title:
                "Reduce product concentration risk",

            summary:
                `The highest-revenue product contributes ${percent(
                    metrics.topProductShare,
                )} of net revenue.`,

            recommendation:
                "Protect availability of the leading product while developing adjacent products, bundles, and substitutes.",

            evidence: [
                `Top product share: ${percent(
                    metrics.topProductShare,
                )}`,
                `Unique products: ${metrics.uniqueProducts.toLocaleString()}`,
            ],

            estimatedImpact:
                metrics.totalRevenue *
                metrics.topProductShare,
        });
    }

    const atRiskSegment =
        rfm.segments.find(
            (segment) =>
                segment.segment ===
                "at_risk",
        );

    if (
        atRiskSegment &&
        atRiskSegment.revenue > 0
    ) {
        actions.push({
            id: "rfm-at-risk-customers",
            priority: "high",
            category: "customer",

            title:
                "Prioritize at-risk high-value customers",

            summary:
                `${atRiskSegment.customers.toLocaleString()} at-risk customers account for ` +
                `${money(
                    atRiskSegment.revenue,
                )} in historical revenue.`,

            recommendation:
                "Create a targeted retention list using last purchase date, prior order value, and preferred products.",

            evidence: [
                `At-risk customers: ${atRiskSegment.customers.toLocaleString()}`,
                `Historical revenue: ${money(
                    atRiskSegment.revenue,
                )}`,
                `Average revenue: ${money(
                    atRiskSegment.averageRevenue,
                )}`,
            ],

            estimatedImpact:
            atRiskSegment.revenue,
        });
    }

    const excludedRate =
        cleaning.sourceRows === 0
            ? 0
            : cleaning.rejectedRows /
            cleaning.sourceRows;

    if (excludedRate >= 0.02) {
        actions.push({
            id: "data-quality-exclusions",
            priority:
                excludedRate >= 0.1
                    ? "high"
                    : "medium",

            category:
                "data_quality",

            title:
                "Improve source-data completeness",

            summary:
                `${percent(
                    excludedRate,
                )} of source rows were excluded from analysis.`,

            recommendation:
                "Review the excluded-row sample and correct missing dates, products, or numeric fields in the source system.",

            evidence: [
                `Rows excluded: ${cleaning.rejectedRows.toLocaleString()}`,
                `Source rows: ${cleaning.sourceRows.toLocaleString()}`,
            ],

            estimatedImpact: null,
        });
    }

    if (
        metrics.customerCoverage <
        0.8
    ) {
        actions.push({
            id: "customer-data-coverage",
            priority: "medium",
            category:
                "data_quality",

            title:
                "Increase customer identification coverage",

            summary:
                `Only ${percent(
                    metrics.customerCoverage,
                )} of accepted line items contain a customer identifier.`,

            recommendation:
                "Capture a consistent customer ID on every eligible transaction so retention and lifetime-value analysis cover more revenue.",

            evidence: [
                `Customer coverage: ${percent(
                    metrics.customerCoverage,
                )}`,
                `Known customers: ${metrics.uniqueCustomers.toLocaleString()}`,
            ],

            estimatedImpact: null,
        });
    }

    return actions.sort(
        (left, right) => {
            const priorityDifference =
                priorityWeight(
                    right.priority,
                ) -
                priorityWeight(
                    left.priority,
                );

            if (
                priorityDifference !== 0
            ) {
                return priorityDifference;
            }

            return (
                (right.estimatedImpact ??
                    0) -
                (left.estimatedImpact ??
                    0)
            );
        },
    );
}