import {
    money,
    pct,
    signedMoney,
    signedPct,
} from "./formatters";

export function buildExecutiveHeadline(
    currentRevenue: number,
    changeRate: number | null,
): string {
    if (changeRate === null) {
        return `The business generated ${money(
            currentRevenue,
        )} in analyzed net revenue.`;
    }

    if (Math.abs(changeRate) < 0.005) {
        return `Net revenue remained broadly stable at ${money(
            currentRevenue,
        )}.`;
    }

    return (
        `Net revenue ${changeRate > 0 ? "grew" : "declined"} ` +
        `${pct(Math.abs(changeRate))} to ${money(currentRevenue)}.`
    );
}

export function buildExecutiveNarrative(
    currentRevenue: number,
    change: number | null,
    changeRate: number | null,
    driver?: {
        label: string;
        impact: number;
    },
    risk?: string,
): string {
    const performance =
        change === null
            ? `The analyzed data produced ${money(
                currentRevenue,
            )} in net revenue.`
            : `Revenue changed by ${signedMoney(change)} ` +
            `(${signedPct(changeRate)}) to ${money(currentRevenue)}.`;

    const driverSummary = driver
        ? `${driver.label} was the largest measured driver at ` +
        `${signedMoney(driver.impact)}.`
        : "";

    return [performance, driverSummary, risk ?? ""]
        .filter(Boolean)
        .join(" ");
}
