"use client";

import {
    useParams,
} from "next/navigation";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    AnalysisResult,
} from "@/lib/reportforge/types";

import {
    getReportAnalysis,
} from "@/lib/reportforge/upload-storage";

import {
    buildProfessionalReportModel,
} from "@/lib/reportforge/professional-report/build-report-model";

import {
    DEFAULT_REPORT_SETTINGS,
    getReportSettings,
    saveReportSettings,
} from "@/lib/reportforge/professional-report/report-settings";

import type {
    ReportSettings,
} from "@/lib/reportforge/professional-report/types";

import {
    ProfessionalReport,
} from "./ProfessionalReport";

import {
    ReportToolbar,
} from "./ReportToolbar";

import "./report-print.css";

export default function ProfessionalReportPage() {
    const params =
        useParams<{
            reportId: string;
        }>();

    const reportId =
        params.reportId;

    const [
        analysis,
        setAnalysis,
    ] =
        useState<AnalysisResult | null>(
            null,
        );

    const [
        settings,
        setSettings,
    ] =
        useState<ReportSettings>({
            ...DEFAULT_REPORT_SETTINGS,
        });

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null,
        );

    const [
        saving,
        setSaving,
    ] =
        useState(false);

    useEffect(
        () => {
            let cancelled =
                false;

            async function loadReport(): Promise<void> {
                try {
                    const [
                        storedAnalysis,
                        storedSettings,
                    ] =
                        await Promise.all([
                            getReportAnalysis(
                                reportId,
                            ),

                            getReportSettings(
                                reportId,
                            ),
                        ]);

                    if (
                        !storedAnalysis?.metrics ||
                        !storedAnalysis.cleaning ||
                        !storedAnalysis.summaries ||
                        !storedAnalysis.advanced
                    ) {
                        throw new Error(
                            "The completed analysis could not be found. Upload and analyze the spreadsheet again.",
                        );
                    }

                    if (cancelled) {
                        return;
                    }

                    setAnalysis(
                        storedAnalysis,
                    );

                    setSettings({
                        ...DEFAULT_REPORT_SETTINGS,
                        ...storedSettings,
                    });
                } catch (caughtError) {
                    if (cancelled) {
                        return;
                    }

                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : "The report could not be opened.",
                    );
                }
            }

            void loadReport();

            return () => {
                cancelled =
                    true;
            };
        },
        [
            reportId,
        ],
    );

    const model =
        useMemo(
            () => {
                if (!analysis) {
                    return null;
                }

                return buildProfessionalReportModel(
                    analysis,
                    settings,
                );
            },
            [
                analysis,
                settings,
            ],
        );

    async function handleSaveSettings(): Promise<void> {
        setSaving(
            true,
        );

        try {
            await saveReportSettings(
                reportId,
                settings,
            );
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "The report settings could not be saved.",
            );
        } finally {
            setSaving(
                false,
            );
        }
    }

    if (error) {
        return (
            <main className="state">
                <div>
                    <b>
                        RF
                    </b>

                    <h1>
                        Report unavailable
                    </h1>

                    <p>
                        {error}
                    </p>

                    <a href="/">
                        Upload another spreadsheet
                    </a>
                </div>
            </main>
        );
    }

    if (!model) {
        return (
            <main className="state">
                <p>
                    Building professional report…
                </p>
            </main>
        );
    }

    return (
        <>
            <ReportToolbar
                reportId={reportId}
                settings={settings}
                onChange={setSettings}
                onSave={handleSaveSettings}
                saving={saving}
            />

            <ProfessionalReport
                model={model}
            />
        </>
    );
}