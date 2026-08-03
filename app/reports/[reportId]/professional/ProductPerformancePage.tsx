import { pct } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";
import { HorizontalBarChart } from "./charts/HorizontalBarChart";

export function ProductPerformancePage({
                                           model,
                                           page,
                                       }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Product performance"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Product performance
                </p>
                <h1>
                    Portfolio momentum and return risk
                </h1>
                <p>
                    Product rankings combine revenue,
                    recent momentum, and detected return
                    activity.
                </p>
            </div>

            <div className="report-strip">
                <article>
                    <span>Top product share</span>
                    <strong>
                        {pct(model.products.topShare)}
                    </strong>
                </article>
                <article>
                    <span>Growing products shown</span>
                    <strong>
                        {model.products.growing.length}
                    </strong>
                </article>
                <article>
                    <span>Declining products shown</span>
                    <strong>
                        {model.products.declining.length}
                    </strong>
                </article>
            </div>

            <div className="report-columns">
                <section className="report-card">
                    <h2>Fastest-growing products</h2>
                    <HorizontalBarChart
                        items={
                            model.products.growing
                        }
                        limit={7}
                    />
                </section>

                <section className="report-card">
                    <h2>Fastest-declining products</h2>
                    <HorizontalBarChart
                        items={
                            model.products.declining
                        }
                        limit={7}
                    />
                </section>
            </div>

            <section className="report-card">
                <h2>Return-risk watch</h2>
                <HorizontalBarChart
                    items={model.products.returns}
                    limit={8}
                />
            </section>

            <section className="report-card">
                <h2>Top products by revenue</h2>
                <HorizontalBarChart
                    items={model.products.top}
                    limit={8}
                />
            </section>
        </ReportPage>
    );
}
