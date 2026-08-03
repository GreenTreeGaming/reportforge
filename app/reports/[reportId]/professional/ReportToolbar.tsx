"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { ReportSettings } from "@/lib/reportforge/professional-report/types";

export function ReportToolbar({
                                  reportId,
                                  settings,
                                  onChange,
                                  onSave,
                                  saving,
                              }: {
    reportId: string;
    settings: ReportSettings;
    onChange: (settings: ReportSettings) => void;
    onSave: () => Promise<void>;
    saving: boolean;
}) {
    const [open, setOpen] = useState(false);
    const fileInput =
        useRef<HTMLInputElement | null>(null);

    async function loadLogo(
        file: File | undefined,
    ): Promise<void> {
        if (!file) return;

        if (
            !file.type.startsWith("image/") ||
            file.size > 2_000_000
        ) {
            window.alert(
                "Choose an image smaller than 2 MB.",
            );
            return;
        }

        const dataUrl = await new Promise<string>(
            (resolve, reject) => {
                const reader = new FileReader();

                reader.onload = () => {
                    if (
                        typeof reader.result === "string"
                    ) {
                        resolve(reader.result);
                    } else {
                        reject(
                            new Error(
                                "The logo could not be read.",
                            ),
                        );
                    }
                };

                reader.onerror = () =>
                    reject(
                        new Error(
                            "The logo could not be read.",
                        ),
                    );

                reader.readAsDataURL(file);
            },
        );

        onChange({
            ...settings,
            logoDataUrl: dataUrl,
        });
    }

    return (
        <>
            <nav className="report-toolbar no-print">
                <span className="report-toolbar-brand">
                    <b>RF</b>
                    <i>Professional report</i>
                </span>

                <div className="report-toolbar-actions">
                    <Link
                        href={`/reports/${reportId}/overview`}
                    >
                        Back to overview
                    </Link>

                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                    >
                        Customize
                    </button>

                    <button
                        type="button"
                        className="primary"
                        onClick={() => window.print()}
                    >
                        Save as PDF
                    </button>
                </div>
            </nav>

            {open ? (
                <div className="report-modal no-print">
                    <button
                        type="button"
                        className="report-modal-backdrop"
                        aria-label="Close settings"
                        onClick={() => setOpen(false)}
                    />

                    <aside className="report-modal-panel">
                        <header>
                            <div>
                                <small>Report settings</small>
                                <h2>
                                    Customize the document
                                </h2>
                            </div>

                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() =>
                                    setOpen(false)
                                }
                            >
                                ×
                            </button>
                        </header>

                        <main>
                            <label>
                                Business name
                                <input
                                    value={
                                        settings.businessName
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...settings,
                                            businessName:
                                            event.target
                                                .value,
                                        })
                                    }
                                />
                            </label>

                            <label>
                                Report title
                                <input
                                    value={
                                        settings.reportTitle
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...settings,
                                            reportTitle:
                                            event.target
                                                .value,
                                        })
                                    }
                                />
                            </label>

                            <div className="report-form-grid">
                                <label>
                                    Prepared for
                                    <input
                                        value={
                                            settings.preparedFor ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            onChange({
                                                ...settings,
                                                preparedFor:
                                                    event.target
                                                        .value ||
                                                    null,
                                            })
                                        }
                                    />
                                </label>

                                <label>
                                    Prepared by
                                    <input
                                        value={
                                            settings.preparedBy ??
                                            ""
                                        }
                                        onChange={(event) =>
                                            onChange({
                                                ...settings,
                                                preparedBy:
                                                    event.target
                                                        .value ||
                                                    null,
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <label>
                                Reporting label
                                <input
                                    value={
                                        settings.reportingLabel
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...settings,
                                            reportingLabel:
                                            event.target
                                                .value,
                                        })
                                    }
                                />
                            </label>

                            <label>
                                Executive note
                                <textarea
                                    rows={5}
                                    value={
                                        settings.executiveNote ??
                                        ""
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...settings,
                                            executiveNote:
                                                event.target
                                                    .value ||
                                                null,
                                        })
                                    }
                                />
                            </label>

                            <div className="report-form-grid">
                                <label>
                                    Accent color
                                    <input
                                        type="color"
                                        value={
                                            settings.accentColor
                                        }
                                        onChange={(event) =>
                                            onChange({
                                                ...settings,
                                                accentColor:
                                                event.target
                                                    .value,
                                            })
                                        }
                                    />
                                </label>

                                <label>
                                    Page size
                                    <select
                                        value={
                                            settings.pageSize
                                        }
                                        onChange={(event) =>
                                            onChange({
                                                ...settings,
                                                pageSize:
                                                    event.target
                                                        .value ===
                                                    "letter"
                                                        ? "letter"
                                                        : "a4",
                                            })
                                        }
                                    >
                                        <option value="a4">
                                            A4
                                        </option>
                                        <option value="letter">
                                            US Letter
                                        </option>
                                    </select>
                                </label>
                            </div>

                            <div className="report-logo-row">
                                <input
                                    ref={fileInput}
                                    hidden
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                        void loadLogo(
                                            event.target
                                                .files?.[0],
                                        );
                                        event.target.value =
                                            "";
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        fileInput.current?.click()
                                    }
                                >
                                    {settings.logoDataUrl
                                        ? "Replace logo"
                                        : "Upload logo"}
                                </button>

                                {settings.logoDataUrl ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                ...settings,
                                                logoDataUrl:
                                                    null,
                                            })
                                        }
                                    >
                                        Remove
                                    </button>
                                ) : null}
                            </div>

                            <label className="report-checkbox">
                                <input
                                    type="checkbox"
                                    checked={
                                        settings.includeMethodology
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...settings,
                                            includeMethodology:
                                            event.target
                                                .checked,
                                        })
                                    }
                                />
                                Include methodology page
                            </label>
                        </main>

                        <footer>
                            <button
                                type="button"
                                onClick={() =>
                                    setOpen(false)
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="primary"
                                disabled={saving}
                                onClick={async () => {
                                    await onSave();
                                    setOpen(false);
                                }}
                            >
                                {saving
                                    ? "Saving…"
                                    : "Save changes"}
                            </button>
                        </footer>
                    </aside>
                </div>
            ) : null}
        </>
    );
}
