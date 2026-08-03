import type {
    KpiComparison,
    PerformanceAnalytics,
    RevenueBridgeStep,
    RevenueDriver,
} from "@/lib/reportforge/types";

function money(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function percent(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
    }).format(value);
}

function compactMoney(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}

export function KpiChange({
                              comparison,
                              format = "money",
                          }: {
    comparison: KpiComparison;
    format?: "money" | "number";
}) {
    const favorable = comparison.absoluteChange >= 0;

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
                className={[
                    "rounded-full px-2 py-1 text-[11px] font-bold",
                    favorable
                        ? "bg-[#e8f5ec] text-[#176636]"
                        : "bg-[#fbeceb] text-[#9b2c25]",
                ].join(" ")}
            >
                {favorable ? "↑" : "↓"}{" "}
                {comparison.changeRate === null
                    ? "New baseline"
                    : percent(Math.abs(comparison.changeRate))}
            </span>

            <span className="text-xs text-[#777772]">
                {comparison.absoluteChange >= 0 ? "+" : "−"}
                {format === "money"
                    ? money(Math.abs(comparison.absoluteChange))
                    : Math.round(Math.abs(comparison.absoluteChange)).toLocaleString()} vs previous
            </span>
        </div>
    );
}

export function RevenueIntelligence({
                                        performance,
                                    }: {
    performance: PerformanceAnalytics;
}) {
    if (
        !performance.window ||
        !performance.current ||
        !performance.previous ||
        !performance.kpis
    ) {
        return (
            <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
                <h2 className="text-lg font-semibold">Revenue intelligence</h2>
                <p className="mt-2 text-sm leading-6 text-[#777772]">
                    At least two dated periods are required for comparisons and
                    revenue-driver analysis.
                </p>
            </section>
        );
    }

    return (
        <>
            <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <RevenueBridge
                    steps={performance.revenueBridge}
                    windowDays={performance.window.windowDays}
                />

                <RevenueDrivers
                    drivers={performance.revenueDrivers}
                    coverage={performance.customerCoverage}
                />
            </section>
        </>
    );
}

function RevenueBridge({
                           steps,
                           windowDays,
                       }: {
    steps: RevenueBridgeStep[];
    windowDays: number;
}) {
    const maximum = Math.max(
        ...steps.map((step) => Math.abs(step.value)),
        1,
    );

    return (
        <article className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">Revenue bridge</h2>
                    <p className="mt-2 text-sm leading-6 text-[#777772]">
                        How the latest {windowDays}-day period moved from the
                        preceding matching period.
                    </p>
                </div>

                <span className="rounded-full bg-[#f1f3fa] px-3 py-1.5 text-xs font-semibold text-[#3151a4]">
                    Fully reconciled
                </span>
            </div>

            <div className="mt-6 space-y-4">
                {steps.map((step) => (
                    <BridgeRow key={step.id} step={step} maximum={maximum} />
                ))}
            </div>
        </article>
    );
}

function BridgeRow({
                       step,
                       maximum,
                   }: {
    step: RevenueBridgeStep;
    maximum: number;
}) {
    const width = Math.max(3, Math.abs(step.value) / maximum * 100);
    const isTotal = step.kind === "total";
    const isIncrease = step.kind === "increase";

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className={isTotal ? "font-semibold" : "text-[#696965]"}>
                    {step.label}
                </span>

                <span
                    className={[
                        "font-semibold tabular-nums",
                        !isTotal && isIncrease ? "text-[#176636]" : "",
                        !isTotal && !isIncrease ? "text-[#a42a20]" : "",
                    ].join(" ")}
                >
                    {!isTotal && step.value > 0 ? "+" : ""}
                    {money(step.value)}
                </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-[#efefea]">
                <div
                    className={[
                        "h-full rounded-full",
                        isTotal
                            ? "bg-[#191918]"
                            : isIncrease
                                ? "bg-[#2f8a52]"
                                : "bg-[#c5544b]",
                    ].join(" ")}
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    );
}

function RevenueDrivers({
                            drivers,
                            coverage,
                        }: {
    drivers: RevenueDriver[];
    coverage: number;
}) {
    const maximum = Math.max(
        ...drivers.map((driver) => Math.abs(driver.contribution)),
        1,
    );

    return (
        <article className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">What drove the change?</h2>
            <p className="mt-2 text-sm leading-6 text-[#777772]">
                Revenue change separated into customer count, purchase
                frequency, average order value, and unattributed activity.
            </p>

            <div className="mt-5 rounded-xl bg-[#f6f6f2] p-4">
                <p className="text-xs font-medium text-[#777772]">
                    Customer-attributed coverage
                </p>
                <p className="mt-1 text-xl font-semibold">{percent(coverage)}</p>
            </div>

            <div className="mt-5 space-y-5">
                {drivers.map((driver) => (
                    <DriverRow
                        key={driver.id}
                        driver={driver}
                        maximum={maximum}
                    />
                ))}
            </div>
        </article>
    );
}

function DriverRow({
                       driver,
                       maximum,
                   }: {
    driver: RevenueDriver;
    maximum: number;
}) {
    const positive = driver.contribution >= 0;
    const width = Math.max(
        4,
        Math.abs(driver.contribution) / maximum * 100,
    );

    return (
        <div>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold">{driver.label}</p>
                    <p className="mt-1 text-xs text-[#777772]">
                        {formatDriverValue(driver.id, driver.previousValue)} →{" "}
                        {formatDriverValue(driver.id, driver.currentValue)}
                        {driver.valueChangeRate === null
                            ? ""
                            : ` · ${driver.valueChangeRate >= 0 ? "+" : ""}${percent(driver.valueChangeRate)}`}
                    </p>
                </div>

                <p
                    className={[
                        "text-sm font-bold tabular-nums",
                        positive ? "text-[#176636]" : "text-[#a42a20]",
                    ].join(" ")}
                >
                    {positive ? "+" : "−"}
                    {compactMoney(Math.abs(driver.contribution))}
                </p>
            </div>

            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#efefea]">
                <div
                    className={[
                        "h-full rounded-full",
                        positive ? "bg-[#2f8a52]" : "bg-[#c5544b]",
                    ].join(" ")}
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    );
}

function formatDriverValue(id: string, value: number): string {
    if (id === "aov" || id === "unattributed") {
        return money(value);
    }

    if (id === "frequency") {
        return value.toFixed(2);
    }

    return Math.round(value).toLocaleString();
}
