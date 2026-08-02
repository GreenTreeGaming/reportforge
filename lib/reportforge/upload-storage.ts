import {
    del,
    get,
    set,
} from "idb-keyval";

const uploadKey = (
    reportId: string,
): string => `reportforge-upload:${reportId}`;

export async function saveReportUpload(
    reportId: string,
    file: File,
): Promise<void> {
    await set(uploadKey(reportId), file);
}

export async function getReportUpload(
    reportId: string,
): Promise<File | null> {
    const stored = await get<File>(
        uploadKey(reportId),
    );

    return stored instanceof File
        ? stored
        : null;
}

export async function deleteReportUpload(
    reportId: string,
): Promise<void> {
    await del(uploadKey(reportId));
}