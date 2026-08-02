import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { parseSpreadsheet } from "@/lib/reportforge/parsing";
import type {
    ApiErrorResponse,
    InspectSpreadsheetResponse,
} from "@/lib/reportforge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    request: Request,
): Promise<
    NextResponse<
        InspectSpreadsheetResponse | ApiErrorResponse
    >
> {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

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

        const parsed = await parseSpreadsheet(file);

        return NextResponse.json({
            reportId: randomUUID(),
            filename: parsed.filename,
            sheetName: parsed.sheetName,
            rowCount: parsed.rows.length,
            columnCount: parsed.columns.length,
            columns: parsed.columns,
            preview: parsed.rows.slice(0, 20),
            warnings: parsed.warnings,
        });
    } catch (error) {
        console.error(
            "Spreadsheet inspection failed:",
            error,
        );

        return NextResponse.json(
            {
                message:
                    error instanceof Error
                        ? error.message
                        : "The spreadsheet could not be inspected.",
            },
            {
                status: 422,
            },
        );
    }
}