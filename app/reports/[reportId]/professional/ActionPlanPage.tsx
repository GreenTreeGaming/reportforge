import { money } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";

export function ActionPlanPage({
                                   model,
                                   page,
                               }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Recommended action plan"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Recommended action plan
                </p>
                <h1>Prioritized next steps</h1>
                <p>
                    Actions are ranked by urgency and
                    measurable materiality. Validate them
                    against business context before
                    implementation.
                </p>
            </div>

            <div className="report-action-list">
                {model.actions.length ? (
                    model.actions.map(
                        (action, index) => (
                            <article
                                key={action.id}
                                className="report-action"
                            >
                                <div className="report-action-number">
                                    {String(
                                        index + 1,
                                    ).padStart(2, "0")}
                                </div>

                                <div className="report-action-copy">
                                    <div className="report-action-meta">
                                        <span
                                            className={`is-${action.priority}`}
                                        >
                                            {action.priority}
                                        </span>
                                        <span>
                                            {action.category}
                                        </span>
                                        <span>
                                            {action.timing}
                                        </span>
                                    </div>

                                    <h2>{action.title}</h2>
                                    <p>{action.summary}</p>

                                    <aside>
                                        <b>
                                            Recommended action
                                        </b>
                                        <p>
                                            {
                                                action.recommendation
                                            }
                                        </p>
                                    </aside>

                                    <div className="report-evidence">
                                        {action.evidence.map(
                                            (evidence) => (
                                                <span
                                                    key={
                                                        evidence
                                                    }
                                                >
                                                    {evidence}
                                                </span>
                                            ),
                                        )}
                                    </div>
                                </div>

                                <div className="report-action-impact">
                                    <span>Value affected</span>
                                    <strong>
                                        {action.impact === null
                                            ? "Not quantified"
                                            : money(
                                                action.impact,
                                            )}
                                    </strong>
                                </div>
                            </article>
                        ),
                    )
                ) : (
                    <section className="report-card">
                        <p className="report-empty">
                            No major actions exceeded the
                            current evidence thresholds.
                        </p>
                    </section>
                )}
            </div>
        </ReportPage>
    );
}
