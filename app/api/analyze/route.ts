import { NextResponse } from "next/server";

import {
    cleanSalesRows,
} from "@/lib/reportforge/cleaning";
import {
    calculateMetrics,
} from "@/lib/reportforge/metrics";
import {
    parseSpreadsheet,
} from "@/lib/reportforge/parsing";
import type {
    ApiErrorResponse,
    ColumnMapping,
} from "@/lib/reportforge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeResponse = {
    metrics: ReturnType<
        typeof calculateMetrics
    >;
    cleaning: ReturnType<
        typeof cleanSalesRows
    >["summary"];
    rejectedRows: ReturnType<
        typeof cleanSalesRows
    >["rejectedRows"];
    preview: ReturnType<
        typeof cleanSalesRows
    >["rows"];
};

function parseMapping(
    raw: FormDataEntryValue | null,
): ColumnMapping {
    if (typeof raw !== "string") {
        throw new Error(
            "Column mapping is required.",
        );
    }

    const parsed = JSON.parse(
        raw,
    ) as ColumnMapping;

    if (
        !parsed.date ||
        !parsed.customer ||
        !parsed.product ||
        !parsed.revenue
    ) {
        throw new Error(
            "The column mapping is incomplete.",
        );
    }

    return parsed;
}

export async function POST(
    request: Request,
): Promise<
    NextResponse<
        AnalyzeResponse | ApiErrorResponse
    >
> {
    try {
        const formData =
            await request.formData();

        const file =
            formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    message:
                        "A spreadsheet file is required.",
                },
                {
                    status: 400,
                },
            );
        }

        const mapping = parseMapping(
            formData.get("mapping"),
        );

        const parsed =
            await parseSpreadsheet(file);

        const cleaning =
            cleanSalesRows(
                parsed.rows,
                mapping,
            );

        if (cleaning.rows.length === 0) {
            return NextResponse.json(
                {
                    message:
                        "No usable sales rows remained after cleaning.",
                },
                {
                    status: 422,
                },
            );
        }

        const metrics =
            calculateMetrics(
                cleaning.rows,
            );

        return NextResponse.json({
            metrics,
            cleaning: cleaning.summary,
            rejectedRows:
                cleaning.rejectedRows.slice(
                    0,
                    100,
                ),
            preview:
                cleaning.rows.slice(
                    0,
                    100,
                ),
        });
    } catch (error) {
        console.error(
            "Report analysis failed:",
            error,
        );

        return NextResponse.json(
            {
                message:
                    error instanceof Error
                        ? error.message
                        : "The report could not be analyzed.",
            },
            {
                status: 422,
            },
        );
    }
}