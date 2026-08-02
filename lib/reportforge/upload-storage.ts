import {
    del,
    get,
    set,
} from "idb-keyval";

import type {
    AnalysisResult,
} from "./types";

const uploadKey = (
    reportId: string,
): string =>
    `reportforge-upload:${reportId}`;

const analysisKey = (
    reportId: string,
): string =>
    `reportforge-analysis:${reportId}`;

export async function saveReportUpload(
    reportId: string,
    file: File,
): Promise<void> {
    await set(
        uploadKey(reportId),
        file,
    );
}

export async function getReportUpload(
    reportId: string,
): Promise<File | null> {
    const stored = await get<unknown>(
        uploadKey(reportId),
    );

    return stored instanceof File
        ? stored
        : null;
}

export async function deleteReportUpload(
    reportId: string,
): Promise<void> {
    await del(
        uploadKey(reportId),
    );
}

export async function saveReportAnalysis(
    reportId: string,
    analysis: AnalysisResult,
): Promise<void> {
    await set(
        analysisKey(reportId),
        analysis,
    );
}

export async function getReportAnalysis(
    reportId: string,
): Promise<AnalysisResult | null> {
    const stored =
        await get<AnalysisResult>(
            analysisKey(reportId),
        );

    if (
        !stored ||
        typeof stored !== "object"
    ) {
        return null;
    }

    return stored;
}

export async function deleteReportAnalysis(
    reportId: string,
): Promise<void> {
    await del(
        analysisKey(reportId),
    );
}

export async function deleteReportData(
    reportId: string,
): Promise<void> {
    await Promise.all([
        deleteReportUpload(reportId),
        deleteReportAnalysis(reportId),
    ]);
}