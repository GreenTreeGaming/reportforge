"use client";

import Link from "next/link";
import {
    useParams,
    useRouter,
} from "next/navigation";
import {
    FormEvent,
    useEffect,
    useState,
} from "react";
import type {
    ColumnMapping,
    NumericFieldMapping,
} from "@/lib/reportforge/types";

import {
    guessMapping,
} from "@/lib/reportforge/mapping";

type StoredInspection = {
    reportId: string;
    filename: string;
    sheetName: string | null;
    rowCount: number;
    columnCount: number;
    columns: string[];
    preview: Record<string, unknown>[];
    warnings: string[];
};

type MappingState = ColumnMapping;

const EMPTY_MAPPING: MappingState = {
    date: "",
    customer: null,
    product: "",
    orderId: null,
    region: null,
    revenue: {
        mode: "none",
    },
    cost: {
        mode: "none",
    },
};

function normalized(value: string): string {
    return value
        .toLowerCase()
        .replace(/[_\-/]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export default function MappingPage() {
    const params = useParams<{
        reportId: string;
    }>();

    const router = useRouter();

    const reportId = params.reportId;

    const [inspection, setInspection] =
        useState<StoredInspection | null>(null);

    const [mapping, setMapping] =
        useState<MappingState>(EMPTY_MAPPING);

    const [error, setError] =
        useState<string | null>(null);

    function isNumericMappingComplete(
        mapping: NumericFieldMapping,
        required: boolean,
    ): boolean {
        if (mapping.mode === "column") {
            return Boolean(mapping.column);
        }

        if (mapping.mode === "multiply") {
            return Boolean(
                mapping.leftColumn &&
                mapping.rightColumn &&
                mapping.leftColumn !==
                mapping.rightColumn,
            );
        }

        return !required;
    }

    useEffect(() => {
        const raw = sessionStorage.getItem(
            `reportforge:${reportId}`,
        );

        if (!raw) {
            setError(
                "This upload could not be found. Upload the spreadsheet again.",
            );
            return;
        }

        try {
            const parsed = JSON.parse(
                raw,
            ) as StoredInspection;

            setInspection(parsed);
            setMapping(
                guessMapping(parsed.columns),
            );
        } catch {
            setError(
                "The stored spreadsheet preview is invalid. Upload the file again.",
            );
        }
    }, [reportId]);

    const requiredTextFields = [
        mapping.date,
        mapping.product,
    ];

    const hasAllRequiredFields =
        requiredTextFields.every(Boolean) &&
        isNumericMappingComplete(
            mapping.revenue,
            true,
        );

    const selectedTextColumns = [
        mapping.date,
        mapping.product,
        mapping.customer,
        mapping.orderId,
        mapping.region,
    ].filter(
        (value): value is string =>
            Boolean(value),
    );

    const hasDuplicateTextFields =
        new Set(selectedTextColumns).size !==
        selectedTextColumns.length;

    const costIsValid =
        isNumericMappingComplete(
            mapping.cost,
            false,
        );

    const canContinue =
        hasAllRequiredFields &&
        !hasDuplicateTextFields &&
        costIsValid;

    function updateTextField(
        field: "date" | "customer" | "product",
        value: string,
    ): void {
        setMapping((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ): void {
        event.preventDefault();

        if (!inspection || !canContinue) {
            return;
        }

        router.push(
            `/reports/${encodeURIComponent(
                reportId,
            )}/review`,
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[#f6f6f2] px-5 py-16 text-[#191918]">
                <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-7">
                    <h1 className="text-2xl font-semibold tracking-[-0.04em]">
                        Upload not found
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-[#696965]">
                        {error}
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-flex rounded-xl bg-[#191918] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Return to upload
                    </Link>
                </div>
            </main>
        );
    }

    if (!inspection) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#f6f6f2] text-sm text-[#696965]">
                Reading spreadsheet details…
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f2] text-[#191918]">
            <header className="border-b border-black/8 bg-white">
                <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
                    <Link
                        href="/"
                        className="flex items-center gap-3"
                    >
                        <div className="grid size-9 place-items-center rounded-[11px] bg-[#191918] text-xs font-bold text-white">
                            RF
                        </div>

                        <div className="text-sm font-semibold">
                            ReportForge
                        </div>
                    </Link>

                    <div className="text-xs text-[#777772]">
                        Step 2 of 3
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
                <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2457e6]">
                        Confirm your fields
                    </p>

                    <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                        Tell ReportForge what each column means.
                    </h1>

                    <p className="mt-4 text-base leading-7 text-[#696965]">
                        We made an initial guess from your column names.
                        Check each selection before continuing.
                    </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                    <FileChip>
                        {inspection.filename}
                    </FileChip>

                    <FileChip>
                        {inspection.rowCount.toLocaleString()} rows
                    </FileChip>

                    <FileChip>
                        {inspection.columnCount.toLocaleString()} columns
                    </FileChip>

                    {inspection.sheetName ? (
                        <FileChip>
                            Sheet: {inspection.sheetName}
                        </FileChip>
                    ) : null}
                </div>

                {inspection.warnings.length > 0 ? (
                    <div className="mt-6 rounded-xl border border-[#ead9a8] bg-[#fff9e9] px-4 py-3 text-sm text-[#785810]">
                        {inspection.warnings.map(
                            (warning) => (
                                <p key={warning}>{warning}</p>
                            ),
                        )}
                    </div>
                ) : null}

                <form
                    onSubmit={handleSubmit}
                    className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
                >
                    <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
                        <h2 className="text-lg font-semibold tracking-[-0.025em]">
                            Business fields
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#777772]">
                            Date, product, and revenue are required. Customer, order ID,
                            region, and cost are optional but unlock additional analysis.
                        </p>

                        <div className="mt-6 space-y-5">
                            <FieldSelect
                                label="Date"
                                value={mapping.date}
                                columns={inspection.columns}
                                onChange={(value) =>
                                    updateTextField("date", value)
                                }
                                required
                            />

                            <FieldSelect
                                label="Customer"
                                value={mapping.customer ?? ""}
                                columns={inspection.columns}
                                onChange={(value) =>
                                    setMapping((current) => ({
                                        ...current,
                                        customer: value || null,
                                    }))
                                }
                                allowNone
                            />

                            <FieldSelect
                                label="Product or service"
                                value={mapping.product}
                                columns={inspection.columns}
                                onChange={(value) =>
                                    updateTextField("product", value)
                                }
                                required
                            />

                            <FieldSelect
                                label="Order or invoice ID"
                                value={mapping.orderId ?? ""}
                                columns={inspection.columns}
                                onChange={(value) =>
                                    setMapping((current) => ({
                                        ...current,
                                        orderId: value || null,
                                    }))
                                }
                                allowNone
                            />

                            <FieldSelect
                                label="Country or region"
                                value={mapping.region ?? ""}
                                columns={inspection.columns}
                                onChange={(value) =>
                                    setMapping((current) => ({
                                        ...current,
                                        region: value || null,
                                    }))
                                }
                                allowNone
                            />

                            <NumericMappingField
                                label="Revenue"
                                value={mapping.revenue}
                                columns={inspection.columns}
                                required
                                suggestedCalculation={{
                                    leftColumn:
                                        inspection.columns.find(
                                            (column) =>
                                                normalized(column).includes(
                                                    "quantity",
                                                ),
                                        ) ?? "",
                                    rightColumn:
                                        inspection.columns.find(
                                            (column) => {
                                                const name = normalized(column);

                                                return (
                                                    name.includes("unit price") ||
                                                    name.includes("unitprice")
                                                );
                                            },
                                        ) ?? "",
                                }}
                                onChange={(value) =>
                                    setMapping((current) => ({
                                        ...current,
                                        revenue: value,
                                    }))
                                }
                            />

                            <NumericMappingField
                                label="Cost"
                                value={mapping.cost}
                                columns={inspection.columns}
                                required={false}
                                suggestedCalculation={{
                                    leftColumn:
                                        inspection.columns.find(
                                            (column) =>
                                                normalized(column).includes(
                                                    "quantity",
                                                ),
                                        ) ?? "",
                                    rightColumn:
                                        inspection.columns.find(
                                            (column) => {
                                                const name = normalized(column);

                                                return (
                                                    name.includes("unit cost") ||
                                                    name.includes("unitcost")
                                                );
                                            },
                                        ) ?? "",
                                }}
                                onChange={(value) =>
                                    setMapping((current) => ({
                                        ...current,
                                        cost: value,
                                    }))
                                }
                            />
                        </div>

                        {hasDuplicateTextFields ? (
                            <p className="mt-5 rounded-xl border border-[#efc8c3] bg-[#fff4f2] px-4 py-3 text-sm text-[#a42a20]">
                                Each mapped business field must use a different column.
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={!canContinue}
                            className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#191918] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#d4d4cf] disabled:text-[#8b8b86]"
                        >
                            Continue to review
                        </button>
                    </section>

                    <section className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.025em]">
                                Data preview
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-[#777772]">
                                Showing the first{" "}
                                {Math.min(
                                    inspection.preview.length,
                                    20,
                                )}{" "}
                                rows.
                            </p>
                        </div>

                        <div className="mt-5 overflow-x-auto rounded-xl border border-black/10">
                            <table className="min-w-full border-collapse text-left text-xs">
                                <thead className="bg-[#f6f6f2]">
                                <tr>
                                    {inspection.columns.map(
                                        (column) => (
                                            <th
                                                key={column}
                                                className="whitespace-nowrap border-b border-black/10 px-3 py-3 font-semibold"
                                            >
                                                {column}
                                            </th>
                                        ),
                                    )}
                                </tr>
                                </thead>

                                <tbody>
                                {inspection.preview.map(
                                    (row, rowIndex) => (
                                        <tr
                                            key={rowIndex}
                                            className="border-b border-black/6 last:border-0"
                                        >
                                            {inspection.columns.map(
                                                (column) => (
                                                    <td
                                                        key={column}
                                                        className="max-w-52 whitespace-nowrap px-3 py-3 text-[#696965]"
                                                    >
                                                        {String(
                                                            row[column] ?? "—",
                                                        )}
                                                    </td>
                                                ),
                                            )}
                                        </tr>
                                    ),
                                )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </form>
            </main>
        </div>
    );
}

function FieldSelect({
                         label,
                         value,
                         columns,
                         onChange,
                         required = false,
                         allowNone = false,
                     }: {
    label: string;
    value: string;
    columns: string[];
    onChange: (value: string) => void;
    required?: boolean;
    allowNone?: boolean;
}) {
    return (
        <label className="block">
      <span className="flex items-center justify-between text-sm font-semibold">
        {label}

          <span className="text-xs font-normal text-[#92928d]">
          {required ? "Required" : "Optional"}
        </span>
      </span>

            <select
                value={value}
                required={required}
                onChange={(event) =>
                    onChange(event.target.value)
                }
                className="mt-2 h-11 w-full rounded-xl border border-black/14 bg-white px-3 text-sm outline-none transition focus:border-[#2457e6] focus:ring-3 focus:ring-[#2457e6]/10"
            >
                <option value="">
                    {allowNone
                        ? `No ${label.toLowerCase()} column`
                        : "Select a column"}
                </option>

                {columns.map((column) => (
                    <option
                        key={column}
                        value={column}
                    >
                        {column}
                    </option>
                ))}
            </select>
        </label>
    );
}

function FileChip({
                      children,
                  }: {
    children: React.ReactNode;
}) {
    return (
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#696965]">
      {children}
    </span>
    );
}

function NumericMappingField({
                                 label,
                                 value,
                                 columns,
                                 onChange,
                                 required,
                                 suggestedCalculation,
                             }: {
    label: string;
    value: NumericFieldMapping;
    columns: string[];
    onChange: (
        value: NumericFieldMapping,
    ) => void;
    required: boolean;
    suggestedCalculation?: {
        leftColumn: string;
        rightColumn: string;
    } | null;
}) {
    const selectedMode = value.mode;

    return (
        <fieldset>
            <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold">
                    {label}
                </legend>

                <span className="text-xs text-[#92928d]">
          {required ? "Required" : "Optional"}
        </span>
            </div>

            <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer gap-3 rounded-xl border border-black/10 p-3 transition hover:border-black/20">
                    <input
                        type="radio"
                        name={`${label}-mode`}
                        checked={
                            selectedMode === "column"
                        }
                        onChange={() => {
                            onChange({
                                mode: "column",
                                column: "",
                            });
                        }}
                        className="mt-1"
                    />

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                            Use an existing column
                        </p>

                        <p className="mt-0.5 text-xs text-[#777772]">
                            Choose a column that already contains
                            the total {label.toLowerCase()}.
                        </p>

                        {selectedMode === "column" ? (
                            <select
                                value={value.column}
                                onChange={(event) =>
                                    onChange({
                                        mode: "column",
                                        column:
                                        event.target.value,
                                    })
                                }
                                className="mt-3 h-11 w-full rounded-xl border border-black/14 bg-white px-3 text-sm outline-none focus:border-[#2457e6]"
                            >
                                <option value="">
                                    Select a column
                                </option>

                                {columns.map((column) => (
                                    <option
                                        key={column}
                                        value={column}
                                    >
                                        {column}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>
                </label>

                <label className="flex cursor-pointer gap-3 rounded-xl border border-black/10 p-3 transition hover:border-black/20">
                    <input
                        type="radio"
                        name={`${label}-mode`}
                        checked={
                            selectedMode === "multiply"
                        }
                        onChange={() => {
                            onChange({
                                mode: "multiply",
                                leftColumn:
                                    suggestedCalculation
                                        ?.leftColumn ?? "",
                                rightColumn:
                                    suggestedCalculation
                                        ?.rightColumn ?? "",
                            });
                        }}
                        className="mt-1"
                    />

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                            Calculate from two columns
                        </p>

                        <p className="mt-0.5 text-xs text-[#777772]">
                            Multiply quantity by a unit value.
                        </p>

                        {selectedMode === "multiply" ? (
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <select
                                    value={
                                        value.leftColumn
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...value,
                                            leftColumn:
                                            event.target.value,
                                        })
                                    }
                                    className="h-11 min-w-0 rounded-xl border border-black/14 bg-white px-3 text-sm outline-none focus:border-[#2457e6]"
                                >
                                    <option value="">
                                        Quantity column
                                    </option>

                                    {columns.map((column) => (
                                        <option
                                            key={column}
                                            value={column}
                                        >
                                            {column}
                                        </option>
                                    ))}
                                </select>

                                <span className="text-sm font-semibold text-[#777772]">
                  ×
                </span>

                                <select
                                    value={
                                        value.rightColumn
                                    }
                                    onChange={(event) =>
                                        onChange({
                                            ...value,
                                            rightColumn:
                                            event.target.value,
                                        })
                                    }
                                    className="h-11 min-w-0 rounded-xl border border-black/14 bg-white px-3 text-sm outline-none focus:border-[#2457e6]"
                                >
                                    <option value="">
                                        Unit value column
                                    </option>

                                    {columns.map((column) => (
                                        <option
                                            key={column}
                                            value={column}
                                        >
                                            {column}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        {selectedMode === "multiply" &&
                        value.leftColumn &&
                        value.rightColumn ? (
                            <div className="mt-3 rounded-lg bg-[#edf2ff] px-3 py-2 text-xs font-medium text-[#2457e6]">
                                {label} will be calculated as{" "}
                                {value.leftColumn} ×{" "}
                                {value.rightColumn}
                            </div>
                        ) : null}
                    </div>
                </label>

                {!required ? (
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-black/10 p-3 transition hover:border-black/20">
                        <input
                            type="radio"
                            name={`${label}-mode`}
                            checked={
                                selectedMode === "none"
                            }
                            onChange={() =>
                                onChange({
                                    mode: "none",
                                })
                            }
                            className="mt-1"
                        />

                        <div>
                            <p className="text-sm font-medium">
                                Not available
                            </p>

                            <p className="mt-0.5 text-xs text-[#777772]">
                                Continue without{" "}
                                {label.toLowerCase()} analysis.
                            </p>
                        </div>
                    </label>
                ) : null}
            </div>
        </fieldset>
    );
}