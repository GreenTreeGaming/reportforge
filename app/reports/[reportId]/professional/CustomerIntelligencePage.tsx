import { money, pct } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";
import { HorizontalBarChart } from "./charts/HorizontalBarChart";
import { SegmentChart } from "./charts/SegmentChart";

export function CustomerIntelligencePage({
                                             model,
                                             page,
                                         }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Customer intelligence"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Customer intelligence
                </p>
                <h1>
                    Retention, expansion, and customer
                    value
                </h1>
                <p>
                    Customer movement is derived from
                    matching adjacent periods and should
                    be interpreted alongside customer-ID
                    coverage.
                </p>
            </div>

            <div className="report-strip">
                <article>
                    <span>Repeat customer rate</span>
                    <strong>
                        {pct(model.customer.repeatRate)}
                    </strong>
                </article>
                <article>
                    <span>Customer coverage</span>
                    <strong>
                        {pct(model.customer.coverage)}
                    </strong>
                </article>
                <article>
                    <span>Largest customer share</span>
                    <strong>
                        {pct(model.customer.topShare)}
                    </strong>
                </article>
            </div>

            <section className="report-card">
                <h2>Customer revenue movement</h2>

                <div className="report-movement">
                    {model.customer.movement.map(
                        (item) => (
                            <article
                                key={item.id}
                                className={`is-${item.tone}`}
                            >
                                <span>{item.label}</span>
                                <strong>
                                    {money(item.amount)}
                                </strong>
                                <small>
                                    {item.count.toLocaleString()}{" "}
                                    customers
                                </small>
                            </article>
                        ),
                    )}
                </div>
            </section>

            <div className="report-columns">
                <section className="report-card">
                    <h2>RFM segments</h2>
                    <SegmentChart
                        segments={
                            model.customer.segments
                        }
                    />
                </section>

                <section className="report-card">
                    <h2>
                        Largest customer losses
                    </h2>
                    <HorizontalBarChart
                        items={model.customer.losses}
                        limit={7}
                    />
                </section>
            </div>

            <section className="report-card">
                <h2>Highest-value customers</h2>
                <HorizontalBarChart
                    items={
                        model.customer.topCustomers
                    }
                    limit={8}
                />
            </section>
        </ReportPage>
    );
}
