"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { AnalysisResult } from "@/lib/reportforge/types";
import { getReportAnalysis } from "@/lib/reportforge/upload-storage";
import { buildProfessionalReportModel } from "@/lib/reportforge/professional-report/build-report-model";
import {
    DEFAULT_REPORT_SETTINGS,
    getReportSettings,
    saveReportSettings,
} from "@/lib/reportforge/professional-report/report-settings";
import type { ReportSettings } from "@/lib/reportforge/professional-report/types";

import { ProfessionalReport } from "./ProfessionalReport";
import { ReportToolbar } from "./ReportToolbar";
import "./report-print.css";

export default function ProfessionalReportPage() {
    const { reportId } = useParams<{ reportId: string }>();

    const [analysis, setAnalysis] =
        useState<AnalysisResult | null>(null);
    const [settings, setSettings] =
        useState<ReportSettings>({
            ...DEFAULT_REPORT_SETTINGS,
        });
    const [error, setError] =
        useState<string | null>(null);
    const [saving, setSaving] =
        useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load(): Promise<void> {
            try {
                const [savedAnalysis, savedSettings] =
                    await Promise.all([
                        getReportAnalysis(reportId),
                        getReportSettings(reportId),
                    ]);

                if (
                    !savedAnalysis?.metrics ||
                    !savedAnalysis.cleaning ||
                    !savedAnalysis.summaries ||
                    !savedAnalysis.advanced
                ) {
                    throw new Error(
                        "The completed analysis could not be found. Upload and analyze the spreadsheet again.",
                    );
                }

                if (!cancelled) {
                    setAnalysis(savedAnalysis);
                    setSettings(savedSettings);
                }
            } catch (caughtError) {
                if (!cancelled) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : "The report could not be opened.",
                    );
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [reportId]);

    const model = useMemo(
        () =>
            analysis
                ? buildProfessionalReportModel(
                    analysis,
                    settings,
                )
                : null,
        [analysis, settings],
    );

    async function save(): Promise<void> {
        setSaving(true);

        try {
            await saveReportSettings(
                reportId,
                settings,
            );
        } finally {
            setSaving(false);
        }
    }

    if (error) {
        return (
            <main className="report-state">
                <div>
                    <strong>RF</strong>
                    <h1>Report unavailable</h1>
                    <p>{error}</p>
                    <a href="/">
                        Upload another spreadsheet
                    </a>
                </div>
            </main>
        );
    }

    if (!model) {
        return (
            <main className="report-state">
                <div>
                    <strong>RF</strong>
                    <h1>
                        Building professional report…
                    </h1>
                    <p>
                        Preparing pages, charts,
                        findings, and recommendations.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <>
            <ReportToolbar
                reportId={reportId}
                settings={settings}
                onChange={setSettings}
                onSave={save}
                saving={saving}
            />

            <ProfessionalReport model={model} />
        </>
    );
}
