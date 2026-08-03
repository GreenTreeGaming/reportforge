import Papa from "papaparse";
import * as XLSX from "xlsx";

import type {
    ParsedSpreadsheet,
    RawRow,
} from "./types";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set([
    "csv",
    "xlsx",
]);

function getExtension(filename: string): string {
    return filename
        .split(".")
        .pop()
        ?.toLowerCase()
        .trim() ?? "";
}

function normalizeHeader(
    value: unknown,
    index: number,
): string {
    const normalized = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    return normalized || `Column ${index + 1}`;
}

function makeHeadersUnique(
    headers: string[],
): string[] {
    const counts = new Map<string, number>();

    return headers.map((header) => {
        const count = (counts.get(header) ?? 0) + 1;
        counts.set(header, count);

        return count === 1
            ? header
            : `${header} (${count})`;
    });
}

function isNonEmptyRow(
    row: unknown[],
): boolean {
    return row.some((cell) => {
        if (cell === null || cell === undefined) {
            return false;
        }

        return String(cell).trim() !== "";
    });
}

function matrixToRows(
    matrix: unknown[][],
): {
    rows: RawRow[];
    columns: string[];
} {
    if (matrix.length === 0) {
        throw new Error(
            "The spreadsheet does not contain any rows.",
        );
    }

    const firstMeaningfulRowIndex =
        matrix.findIndex(isNonEmptyRow);

    if (firstMeaningfulRowIndex === -1) {
        throw new Error(
            "The spreadsheet is empty.",
        );
    }

    const trimmedMatrix = matrix.slice(
        firstMeaningfulRowIndex,
    );

    const rawHeaders =
        trimmedMatrix[0]?.map(normalizeHeader) ?? [];

    if (rawHeaders.length === 0) {
        throw new Error(
            "The spreadsheet does not contain column headers.",
        );
    }

    const columns = makeHeadersUnique(rawHeaders);

    const rows = trimmedMatrix
        .slice(1)
        .filter(isNonEmptyRow)
        .map((row) => {
            const record: RawRow = {};

            for (
                let index = 0;
                index < columns.length;
                index += 1
            ) {
                record[columns[index]] =
                    row[index] ?? null;
            }

            return record;
        });

    if (rows.length === 0) {
        throw new Error(
            "The spreadsheet contains headers but no data rows.",
        );
    }

    return {
        rows,
        columns,
    };
}

function parseCsv(
    text: string,
): {
    rows: RawRow[];
    columns: string[];
    warnings: string[];
} {
    const result = Papa.parse<unknown[]>(text, {
        header: false,
        skipEmptyLines: "greedy",
        dynamicTyping: false,
    });

    if (
        result.errors.length > 0 &&
        result.data.length === 0
    ) {
        throw new Error(
            result.errors[0]?.message ??
            "The CSV file could not be parsed.",
        );
    }

    const parsed = matrixToRows(
        result.data as unknown[][],
    );

    return {
        ...parsed,
        warnings: result.errors.map((error) => {
            const row =
                typeof error.row === "number"
                    ? error.row + 1
                    : "unknown";

            return `Row ${row}: ${error.message}`;
        }),
    };
}

function parseWorkbook(
    buffer: ArrayBuffer,
): {
    rows: RawRow[];
    columns: string[];
    sheetName: string;
    warnings: string[];
} {
    let workbook: XLSX.WorkBook;

    try {
        workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: true,
            dense: true,
        });
    } catch {
        throw new Error(
            "The Excel workbook could not be opened.",
        );
    }

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
        throw new Error(
            "The workbook does not contain a worksheet.",
        );
    }

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error(
            "The first worksheet could not be read.",
        );
    }

    const matrix =
        XLSX.utils.sheet_to_json<unknown[]>(
            worksheet,
            {
                header: 1,
                defval: null,
                raw: false,
                blankrows: false,
            },
        );

    const parsed = matrixToRows(matrix);

    const warnings =
        workbook.SheetNames.length > 1
            ? [
                `Only the first worksheet, "${sheetName}", was imported.`,
            ]
            : [];

    return {
        ...parsed,
        sheetName,
        warnings,
    };
}

export async function parseSpreadsheet(
    file: File,
): Promise<ParsedSpreadsheet> {
    if (file.size === 0) {
        throw new Error(
            "The uploaded file is empty.",
        );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
            "The uploaded file must be smaller than 25 MB.",
        );
    }

    const extension = getExtension(file.name);

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
        throw new Error(
            "Upload a CSV or XLSX file.",
        );
    }

    if (extension === "csv") {
        const text = await file.text();
        const parsed = parseCsv(text);

        return {
            filename: file.name,
            sheetName: null,
            ...parsed,
        };
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseWorkbook(buffer);

    return {
        filename: file.name,
        ...parsed,
    };
}