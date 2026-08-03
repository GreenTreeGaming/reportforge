import {
    number,
    pct,
} from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";

export function MethodologyPage({
                                    model,
                                    page,
                                }: {
    model: ReportModel;
    page: number;
}) {
    return (
        <ReportPage
            number={page}
            title="Data confidence and methodology"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Data confidence
                </p>
                <h1>
                    {model.quality.grade} analysis
                    confidence
                </h1>
                <p>
                    The report received a confidence score
                    of {model.quality.score}/100 based on
                    accepted-row coverage, customer
                    identifiers, order identifiers, cost
                    coverage, and historical depth.
                </p>
            </div>

            <div className="report-quality">
                <div
                    className="report-quality-ring"
                    style={{
                        background:
                            `conic-gradient(var(--report-accent) ` +
                            `${model.quality.score}%, #e8ecf2 ` +
                            `${model.quality.score}% 100%)`,
                    }}
                >
                    <div>
                        <strong>
                            {model.quality.score}
                        </strong>
                        <span>out of 100</span>
                    </div>
                </div>

                <div className="report-quality-stats">
                    <article>
                        <span>Source rows</span>
                        <strong>
                            {number(
                                model.quality.rows,
                            )}
                        </strong>
                    </article>
                    <article>
                        <span>Accepted rows</span>
                        <strong>
                            {number(
                                model.quality.accepted,
                            )}
                        </strong>
                    </article>
                    <article>
                        <span>Excluded rows</span>
                        <strong>
                            {number(
                                model.quality.excluded,
                            )}
                        </strong>
                    </article>
                    <article>
                        <span>Cost coverage</span>
                        <strong>
                            {pct(
                                model.quality
                                    .costCoverage,
                            )}
                        </strong>
                    </article>
                </div>
            </div>

            <div className="report-columns">
                <section className="report-card">
                    <h2>Strengths</h2>
                    <ul className="report-list is-good">
                        {model.quality.strengths.map(
                            (strength) => (
                                <li key={strength}>
                                    {strength}
                                </li>
                            ),
                        )}
                    </ul>
                </section>

                <section className="report-card">
                    <h2>Limitations</h2>
                    <ul className="report-list is-risk">
                        {model.quality.limitations.map(
                            (limitation) => (
                                <li key={limitation}>
                                    {limitation}
                                </li>
                            ),
                        )}
                    </ul>
                </section>
            </div>

            <section className="report-card">
                <h2>Methodology</h2>

                <div className="report-method-grid">
                    {[
                        [
                            "Net revenue",
                            "Sum of accepted revenue values after detected returns and cancellations.",
                        ],
                        [
                            "Customer movement",
                            "Customer revenue compared across adjacent matching date windows.",
                        ],
                        [
                            "Product momentum",
                            "Product revenue and order activity compared across matching windows.",
                        ],
                        [
                            "RFM segmentation",
                            "Customer grouping based on recency, frequency, and monetary value.",
                        ],
                        [
                            "Gross profit",
                            "Revenue less mapped cost, available only when cost coverage is sufficient.",
                        ],
                        [
                            "Decision queue",
                            "Rule-based prioritization using measurable risks, opportunities, and data-quality limitations.",
                        ],
                    ].map(([title, copy]) => (
                        <article key={title}>
                            <b>{title}</b>
                            <p>{copy}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="report-card">
                <h2>Assumptions</h2>
                <ul className="report-list">
                    {model.quality.assumptions.map(
                        (assumption) => (
                            <li key={assumption}>
                                {assumption}
                            </li>
                        ),
                    )}
                </ul>
            </section>
        </ReportPage>
    );
}
