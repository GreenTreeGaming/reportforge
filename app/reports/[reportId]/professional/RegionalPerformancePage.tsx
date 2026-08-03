import { money, pct } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";
import { HorizontalBarChart } from "./charts/HorizontalBarChart";

export function RegionalPerformancePage({
                                            model,
                                            page,
                                        }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Geography and profitability"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Geography and profitability
                </p>
                <h1>
                    Where revenue is generated and retained
                </h1>
                <p>
                    Regional results depend on the mapped
                    geography field. Profitability requires
                    usable cost coverage.
                </p>
            </div>

            <div className="report-strip">
                <article>
                    <span>Gross profit</span>
                    <strong>
                        {money(
                            model.profit.grossProfit,
                        )}
                    </strong>
                </article>
                <article>
                    <span>Gross margin</span>
                    <strong>
                        {pct(
                            model.profit.grossMargin,
                        )}
                    </strong>
                </article>
                <article>
                    <span>Cost coverage</span>
                    <strong>
                        {pct(
                            model.profit.costCoverage,
                        )}
                    </strong>
                </article>
            </div>

            {model.regions.available ? (
                <section className="report-card">
                    <h2>Leading regions</h2>
                    <HorizontalBarChart
                        items={model.regions.items}
                        limit={9}
                    />
                </section>
            ) : (
                <section className="report-card">
                    <p className="report-empty">
                        Regional analysis was omitted
                        because no region field was mapped.
                    </p>
                </section>
            )}

            <section className="report-card">
                <h2>Profitability interpretation</h2>

                <div className="report-profit-grid">
                    <article>
                        <span>Total cost</span>
                        <strong>
                            {money(
                                model.profit.totalCost,
                            )}
                        </strong>
                    </article>
                    <article>
                        <span>Gross profit</span>
                        <strong>
                            {money(
                                model.profit.grossProfit,
                            )}
                        </strong>
                    </article>
                    <article>
                        <span>Gross margin</span>
                        <strong>
                            {pct(
                                model.profit.grossMargin,
                            )}
                        </strong>
                    </article>
                </div>

                {!model.profit.available ? (
                    <p className="report-empty">
                        Complete profitability analysis
                        is unavailable because cost data
                        does not cover every accepted row.
                    </p>
                ) : null}
            </section>
        </ReportPage>
    );
}
