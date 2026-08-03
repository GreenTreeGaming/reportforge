import { dateLabel } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";

export function ReportCover({
                                model,
                            }: {
    model: ReportModel;
}) {
    const revenue = model.kpis.find(
        (kpi) => kpi.id === "revenue",
    );

    return (
        <section className="report-page report-cover">
            <div className="report-cover-shape" />

            <header className="report-cover-header">
                <span className="report-brand">
                    <b>RF</b>
                    ReportForge
                </span>
                <span>Confidential</span>
            </header>

            <main className="report-cover-main">
                <div className="report-cover-copy">
                    {model.metadata.logoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={
                                model.metadata.logoDataUrl
                            }
                            alt={`${model.metadata.businessName} logo`}
                        />
                    ) : null}

                    <p className="report-eyebrow">
                        {model.metadata.reportingLabel}
                    </p>

                    <h1>
                        {model.metadata.reportTitle}
                    </h1>

                    <h2>
                        {model.metadata.businessName}
                    </h2>

                    {model.metadata.currentPeriod ? (
                        <p className="report-cover-period">
                            {model.metadata.currentPeriod}
                        </p>
                    ) : null}
                </div>

                <div className="report-cover-stats">
                    <article>
                        <span>Net revenue</span>
                        <strong>
                            {revenue?.value ??
                                "Not available"}
                        </strong>
                    </article>

                    <article>
                        <span>Period change</span>
                        <strong>
                            {revenue?.change ??
                                "Not available"}
                        </strong>
                    </article>

                    <article>
                        <span>Confidence</span>
                        <strong>
                            {model.quality.score}/100
                        </strong>
                    </article>
                </div>
            </main>

            <footer className="report-cover-footer">
                <span>
                    {model.metadata.preparedFor
                        ? `Prepared for ${model.metadata.preparedFor}`
                        : ""}
                </span>

                <span>
                    Generated{" "}
                    {dateLabel(
                        model.metadata.generatedAt,
                    )}
                </span>
            </footer>
        </section>
    );
}
