"use client";

import type {
    CSSProperties,
    ReactNode,
} from "react";

import type { ReportModel } from "@/lib/reportforge/professional-report/types";

import { ActionPlanPage } from "./ActionPlanPage";
import { CustomerIntelligencePage } from "./CustomerIntelligencePage";
import { ExecutiveSummaryPage } from "./ExecutiveSummaryPage";
import { MethodologyPage } from "./MethodologyPage";
import { ProductPerformancePage } from "./ProductPerformancePage";
import { RegionalPerformancePage } from "./RegionalPerformancePage";
import { ReportCover } from "./ReportCover";
import { RevenuePerformancePage } from "./RevenuePerformancePage";

export function ReportPage({
                               number,
                               title,
                               children,
                           }: {
    number: number;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="report-page">
            <header className="report-page-header">
                <span className="report-brand">
                    <b>RF</b>
                    ReportForge
                </span>

                <span>{title}</span>
            </header>

            <main className="report-page-main">
                {children}
            </main>

            <footer className="report-page-footer">
                <span>
                    Confidential business report
                </span>
                <span>
                    {String(number).padStart(2, "0")}
                </span>
            </footer>
        </section>
    );
}

export function ProfessionalReport({
                                       model,
                                   }: {
    model: ReportModel;
}) {
    const style = {
        "--report-accent":
        model.metadata.accentColor,
    } as CSSProperties;

    let page = 1;

    return (
        <div
            className={`professional-report paper-${model.metadata.pageSize}`}
            style={style}
        >
            <main className="report-document">
                <ReportCover model={model} />

                <ExecutiveSummaryPage
                    model={model}
                    page={++page}
                />

                <RevenuePerformancePage
                    model={model}
                    page={++page}
                />

                {model.customer.available ? (
                    <CustomerIntelligencePage
                        model={model}
                        page={++page}
                    />
                ) : null}

                {model.products.available ? (
                    <ProductPerformancePage
                        model={model}
                        page={++page}
                    />
                ) : null}

                {model.regions.available ||
                model.profit.available ? (
                    <RegionalPerformancePage
                        model={model}
                        page={++page}
                    />
                ) : null}

                <ActionPlanPage
                    model={model}
                    page={++page}
                />

                {model.metadata.includeMethodology ? (
                    <MethodologyPage
                        model={model}
                        page={++page}
                    />
                ) : null}
            </main>
        </div>
    );
}
