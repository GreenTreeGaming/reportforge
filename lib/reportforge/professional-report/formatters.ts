type MoneyOptions = {
    maximumFractionDigits?: number;
    compact?: boolean;
};

function isValidNumber(
    value: number | null | undefined,
): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function money(
    value: number | null | undefined,
    options: MoneyOptions = {},
): string {
    if (!isValidNumber(value)) {
        return "Not available";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: options.compact ? "compact" : "standard",
        maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(value);
}

export function compactMoney(
    value: number | null | undefined,
): string {
    return money(value, {
        compact: true,
        maximumFractionDigits: 1,
    });
}

export function number(
    value: number | null | undefined,
    maximumFractionDigits = 0,
): string {
    if (!isValidNumber(value)) {
        return "Not available";
    }

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits,
    }).format(value);
}

export function pct(
    value: number | null | undefined,
    maximumFractionDigits = 1,
): string {
    if (!isValidNumber(value)) {
        return "Not available";
    }

    return new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits,
    }).format(value);
}

export function signedMoney(
    value: number | null | undefined,
): string {
    if (!isValidNumber(value)) {
        return "Not available";
    }

    const formatted = money(Math.abs(value));

    if (value > 0) return `+${formatted}`;
    if (value < 0) return `−${formatted}`;
    return formatted;
}

export function signedPct(
    value: number | null | undefined,
    maximumFractionDigits = 1,
): string {
    if (!isValidNumber(value)) {
        return "Not available";
    }

    const formatted = pct(Math.abs(value), maximumFractionDigits);

    if (value > 0) return `+${formatted}`;
    if (value < 0) return `−${formatted}`;
    return formatted;
}

export function dateLabel(
    value: string | null | undefined,
): string {
    if (!value) {
        return "Not available";
    }

    const parsed = new Date(value);

    if (!Number.isFinite(parsed.getTime())) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(parsed);
}

export function monthLabel(period: string): string {
    const [year, month] = period.split("-").map(Number);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        return period;
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(maximum, Math.max(minimum, value));
}

export const formatMoney = money;
export const formatNumber = number;
export const formatPercent = pct;
export const formatSignedMoney = signedMoney;
export const formatSignedPercent = signedPct;
export const formatDate = dateLabel;
export const formatMonth = monthLabel;
export const date = dateLabel;
export const month = monthLabel;
