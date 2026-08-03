import { money } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";

export function ExecutiveSummaryPage({
                                         model,
                                         page,
                                     }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Executive summary"
        >
            <div className="report-heading">
                <p className="report-eyebrow">
                    Executive summary
                </p>
                <h1>{model.headline}</h1>
                <p>{model.narrative}</p>
            </div>

            {model.metadata.executiveNote ? (
                <aside className="report-management-note">
                    <b>Management note</b>
                    <p>
                        {model.metadata.executiveNote}
                    </p>
                </aside>
            ) : null}

            <div className="report-kpis">
                {model.kpis.map((kpi) => (
                    <article key={kpi.id}>
                        <span>{kpi.label}</span>
                        <strong>{kpi.value}</strong>
                        <b
                            className={`report-direction is-${kpi.direction}`}
                        >
                            {kpi.change ??
                                "No comparison"}
                        </b>
                        <small>{kpi.context}</small>
                    </article>
                ))}
            </div>

            <div className="report-columns">
                <section className="report-card">
                    <h2>Positive signals</h2>

                    {model.highlights.length ? (
                        model.highlights.map((item) => (
                            <div
                                key={item.id}
                                className="report-insight is-good"
                            >
                                <b>{item.title}</b>
                                <strong>{item.value}</strong>
                                <p>{item.detail}</p>
                            </div>
                        ))
                    ) : (
                        <p className="report-empty">
                            No major positive signal
                            exceeded the current
                            thresholds.
                        </p>
                    )}
                </section>

                <section className="report-card">
                    <h2>Risks to address</h2>

                    {model.risks.length ? (
                        model.risks.map((item) => (
                            <div
                                key={item.id}
                                className="report-insight is-risk"
                            >
                                <b>{item.title}</b>
                                <strong>{item.value}</strong>
                                <p>{item.detail}</p>
                            </div>
                        ))
                    ) : (
                        <p className="report-empty">
                            No major risk exceeded the
                            current thresholds.
                        </p>
                    )}
                </section>
            </div>

            <section className="report-dark">
                <p className="report-eyebrow">
                    Immediate priorities
                </p>
                <h2>
                    Actions backed by the strongest
                    available evidence
                </h2>

                {model.actions
                    .slice(0, 3)
                    .map((action, index) => (
                        <article key={action.id}>
                            <b>
                                {String(index + 1).padStart(
                                    2,
                                    "0",
                                )}
                            </b>

                            <div>
                                <strong>
                                    {action.title}
                                </strong>
                                <p>
                                    {action.recommendation}
                                </p>
                            </div>

                            <span>
                                {action.impact === null
                                    ? "Not quantified"
                                    : money(action.impact)}
                            </span>
                        </article>
                    ))}
            </section>
        </ReportPage>
    );
}
