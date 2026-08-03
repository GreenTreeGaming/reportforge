import {
    money,
    pct,
    signedMoney,
    signedPct,
} from "./formatters";

export function buildExecutiveHeadline(
    current: number,
    rate: number | null,
): string {
    if (rate === null) {
        return (
            `The business generated ` +
            `${money(current)} in analyzed net revenue.`
        );
    }

    return (
        `Net revenue ` +
        `${rate >= 0 ? "grew" : "declined"} ` +
        `${pct(Math.abs(rate))} to ` +
        `${money(current)}.`
    );
}

export function buildExecutiveNarrative(
    current: number,
    change: number | null,
    rate: number | null,
    driver?: {
        label: string;
        impact: number;
    },
    risk?: string,
): string {
    const performance =
        change === null
            ? (
                `The analyzed data produced ` +
                `${money(current)} in net revenue.`
            )
            : (
                `Revenue changed by ` +
                `${signedMoney(change)} ` +
                `(${signedPct(rate)}) to ` +
                `${money(current)}.`
            );

    const driverSummary =
        driver
            ? (
                `${driver.label} was the largest ` +
                `measured driver at ` +
                `${signedMoney(driver.impact)}.`
            )
            : "";

    return [
        performance,
        driverSummary,
        risk ?? "",
    ]
        .filter(Boolean)
        .join(" ");
}