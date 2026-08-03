import { signedMoney } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";
import { ReportPage } from "./ProfessionalReport";
import { RevenueBridgeChart } from "./charts/RevenueBridgeChart";
import { TrendChart } from "./charts/TrendChart";

export function RevenuePerformancePage({
                                           model,
                                           page,
                                       }: {
    model: ReportModel;
    page: number;
}) {
    const maximum = Math.max(
        1,
        ...model.drivers.map((driver) =>
            Math.abs(driver.impact),
        ),
    );

    return (
        <ReportPage
            number={page}
            title="Revenue performance"
        >
            <div className="report-heading is-compact">
                <p className="report-eyebrow">
                    Revenue performance
                </p>
                <h1>
                    How performance changed and what
                    drove it
                </h1>
                <p>{model.narrative}</p>
            </div>

            <div className="report-strip">
                {model.kpis
                    .slice(0, 4)
                    .map((kpi) => (
                        <article key={kpi.id}>
                            <span>{kpi.label}</span>
                            <strong>{kpi.value}</strong>
                            <small>
                                {kpi.change ??
                                    kpi.context}
                            </small>
                        </article>
                    ))}
            </div>

            <section className="report-card">
                <h2>Monthly net revenue trend</h2>
                <TrendChart points={model.monthly} />
            </section>

            <section className="report-card">
                <h2>Revenue movement bridge</h2>
                <RevenueBridgeChart
                    items={model.bridge}
                />
            </section>

            <section className="report-card">
                <h2>Measured revenue drivers</h2>

                {model.drivers.length ? (
                    <div className="report-drivers">
                        {model.drivers.map(
                            (driver) => (
                                <article key={driver.id}>
                                    <header>
                                        <b>
                                            {driver.label}
                                        </b>
                                        <strong>
                                            {signedMoney(
                                                driver.impact,
                                            )}
                                        </strong>
                                    </header>

                                    <i>
                                        <span
                                            style={{
                                                width: `${Math.max(
                                                    4,
                                                    (Math.abs(
                                                            driver.impact,
                                                        ) /
                                                        maximum) *
                                                    100,
                                                )}%`,
                                            }}
                                        />
                                    </i>

                                    <p>
                                        {driver.description}
                                    </p>
                                </article>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="report-empty">
                        Driver decomposition requires
                        reliable customer and order
                        coverage in both comparison
                        windows.
                    </p>
                )}
            </section>
        </ReportPage>
    );
}
