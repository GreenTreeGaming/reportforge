import type {
    NumericFieldMapping,
    RawRow,
} from "./types";

export function parseNumber(
    value: unknown,
): number | null {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return value;
    }

    const cleaned = String(value)
        .trim()
        .replace(/[$£€¥,\s]/g, "")
        .replace(/^\((.*)\)$/, "-$1");

    if (!cleaned) {
        return null;
    }

    const parsed = Number(cleaned);

    return Number.isFinite(parsed)
        ? parsed
        : null;
}

export function resolveNumericField(
    row: RawRow,
    mapping: NumericFieldMapping,
): number | null {
    if (mapping.mode === "none") {
        return null;
    }

    if (mapping.mode === "column") {
        return parseNumber(
            row[mapping.column],
        );
    }

    const leftValue = parseNumber(
        row[mapping.leftColumn],
    );

    const rightValue = parseNumber(
        row[mapping.rightColumn],
    );

    if (
        leftValue === null ||
        rightValue === null
    ) {
        return null;
    }

    return leftValue * rightValue;
}