import { get, set } from "idb-keyval";

import type { ReportSettings } from "./types";

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
    businessName: "Business performance report",
    reportTitle: "Business Performance Report",
    preparedFor: null,
    preparedBy: null,
    logoDataUrl: null,
    accentColor: "#2457e6",
    reportingLabel: "Current reporting period",
    executiveNote: null,
    includeMethodology: true,
    pageSize: "a4",
};

function key(reportId: string): string {
    return `reportforge-professional-report:${reportId}`;
}

function sanitize(
    settings: Partial<ReportSettings>,
): ReportSettings {
    return {
        ...DEFAULT_REPORT_SETTINGS,
        ...settings,
        businessName:
            settings.businessName?.trim().slice(0, 120) ||
            DEFAULT_REPORT_SETTINGS.businessName,
        reportTitle:
            settings.reportTitle?.trim().slice(0, 160) ||
            DEFAULT_REPORT_SETTINGS.reportTitle,
        preparedFor:
            settings.preparedFor?.trim().slice(0, 120) || null,
        preparedBy:
            settings.preparedBy?.trim().slice(0, 120) || null,
        reportingLabel:
            settings.reportingLabel?.trim().slice(0, 160) ||
            DEFAULT_REPORT_SETTINGS.reportingLabel,
        executiveNote:
            settings.executiveNote?.trim().slice(0, 1500) || null,
        accentColor: /^#[0-9a-f]{6}$/i.test(
            settings.accentColor ?? "",
        )
            ? settings.accentColor!
            : DEFAULT_REPORT_SETTINGS.accentColor,
        logoDataUrl: settings.logoDataUrl?.startsWith("data:image/")
            ? settings.logoDataUrl
            : null,
        includeMethodology: settings.includeMethodology !== false,
        pageSize: settings.pageSize === "letter" ? "letter" : "a4",
    };
}

export async function getReportSettings(
    reportId: string,
): Promise<ReportSettings> {
    const stored = await get<Partial<ReportSettings>>(key(reportId));
    return sanitize(stored ?? {});
}

export async function saveReportSettings(
    reportId: string,
    settings: ReportSettings,
): Promise<void> {
    await set(key(reportId), sanitize(settings));
}
