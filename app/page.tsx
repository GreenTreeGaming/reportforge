"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  SVGProps,
  useRef,
  useState,
} from "react";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];

type UploadState = "idle" | "selected" | "uploading" | "error";

type InspectResponse = {
  reportId?: string;
  filename?: string;
  sheetName?: string | null;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  preview?: Record<string, unknown>[];
  warnings?: string[];
  message?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");

  return dotIndex === -1
      ? ""
      : filename.slice(dotIndex).toLowerCase();
}

function validateFile(file: File): string | null {
  const extension = getFileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Upload a CSV or XLSX file.";
  }

  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "The file must be smaller than 25 MB.";
  }

  return null;
}

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] =
      useState<UploadState>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseFile(nextFile: File | null): void {
    if (!nextFile) {
      return;
    }

    const validationError = validateFile(nextFile);

    if (validationError) {
      setFile(null);
      setUploadState("error");
      setError(validationError);
      return;
    }

    setFile(nextFile);
    setUploadState("selected");
    setError(null);
  }

  function handleFileInput(
      event: ChangeEvent<HTMLInputElement>,
  ): void {
    chooseFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(
      event: DragEvent<HTMLDivElement>,
  ): void {
    event.preventDefault();
    setIsDragging(false);

    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  function removeFile(): void {
    setFile(null);
    setUploadState("idle");
    setError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleSubmit(
      event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!file || uploadState === "uploading") {
      return;
    }

    setUploadState("uploading");
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/inspect", {
        method: "POST",
        body,
      });

      const result =
          (await response.json()) as InspectResponse;

      if (!response.ok) {
        throw new Error(
            result.message ??
            "The dataset could not be analyzed.",
        );
      }

      if (!result.reportId) {
        throw new Error(
            "The backend did not return a report ID.",
        );
      }

      sessionStorage.setItem(
          `reportforge:${result.reportId}`,
          JSON.stringify({
            reportId: result.reportId,
            filename: result.filename,
            sheetName: result.sheetName,
            rowCount: result.rowCount,
            columnCount: result.columnCount,
            columns: result.columns,
            preview: result.preview,
            warnings: result.warnings,
          }),
      );

      window.location.assign(
          `/reports/${encodeURIComponent(
              result.reportId,
          )}/mapping`,
      );
    } catch (caughtError) {
      setUploadState("error");
      setError(
          caughtError instanceof Error
              ? caughtError.message
              : "An unexpected error occurred.",
      );
    }
  }

  return (
      <div className="min-h-screen bg-[#f6f6f2] text-[#191918]">
        <header className="border-b border-black/8 bg-[#f6f6f2]/90 backdrop-blur">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
            <a
                href="/"
                className="flex items-center gap-3"
                aria-label="ReportForge home"
            >
              <div className="grid size-9 place-items-center rounded-[11px] bg-[#191918] text-xs font-bold text-white">
                RF
              </div>

              <div>
                <div className="text-[15px] font-semibold tracking-[-0.02em]">
                  ReportForge
                </div>
                <div className="hidden text-xs text-[#777772] sm:block">
                  Business reporting made clear
                </div>
              </div>
            </a>

            <nav
                className="flex items-center gap-2"
                aria-label="Primary navigation"
            >
              <a
                  href="#how-it-works"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#696965] transition hover:bg-black/5 hover:text-[#191918] sm:block"
              >
                How it works
              </a>

              <a
                  href="/reports"
                  className="rounded-lg border border-black/12 bg-white px-4 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-black/20 hover:bg-[#fafaf8]"
              >
                View reports
              </a>
            </nav>
          </div>
        </header>

        <main>
          <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-18 pt-16 sm:px-8 sm:pt-22 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center lg:px-10 lg:pb-24 lg:pt-28">
            <div className="max-w-2xl">
              <h1 className="max-w-3xl text-[clamp(2.7rem,6vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.065em]">
                Know what changed.
                <span className="block text-[#777772]">
                Know what to do next.
              </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-[#696965] sm:text-lg sm:leading-8">
                Upload a sales spreadsheet and receive a
                focused report covering performance, customer
                risk, product momentum, margin pressure, and
                growth opportunities.
              </p>

              <div className="mt-9 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <Feature
                    title="Clean the data"
                    description="Recover inconsistent dates, currency, names, and headers."
                />

                <Feature
                    title="Find the signal"
                    description="Separate meaningful changes from ordinary variation."
                />

                <Feature
                    title="Take action"
                    description="See prioritized risks and opportunities with evidence."
                />
              </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_20px_70px_rgba(22,22,20,0.08)] sm:p-5"
            >
              <div className="px-1 pb-4">
                <p className="text-sm font-semibold">
                  Create a report
                </p>

                <p className="mt-1 text-sm leading-6 text-[#777772]">
                  Start with a CSV or Excel workbook. You will
                  confirm the business fields before analysis.
                </p>
              </div>

              <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();

                    if (
                        event.currentTarget ===
                        event.target
                    ) {
                      setIsDragging(false);
                    }
                  }}
                  onDrop={handleDrop}
                  className={[
                    "rounded-[18px] border border-dashed p-5 transition sm:p-7",
                    isDragging
                        ? "border-[#2457e6] bg-[#f3f6ff]"
                        : "border-black/16 bg-[#fafaf8]",
                  ].join(" ")}
              >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileInput}
                    className="sr-only"
                    id="report-file"
                />

                {file ? (
                    <div className="flex items-center gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-white">
                        <FileIcon className="size-5 text-[#2457e6]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {file.name}
                        </p>

                        <p className="mt-1 text-xs text-[#777772]">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      <button
                          type="button"
                          onClick={removeFile}
                          className="rounded-lg p-2 text-[#777772] transition hover:bg-black/5 hover:text-[#191918]"
                          aria-label="Remove selected file"
                      >
                        <CloseIcon className="size-4" />
                      </button>
                    </div>
                ) : (
                    <label
                        htmlFor="report-file"
                        className="flex cursor-pointer flex-col items-center py-4 text-center"
                    >
                      <div className="grid size-12 place-items-center rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <UploadIcon className="size-5 text-[#2457e6]" />
                      </div>

                      <p className="mt-4 text-sm font-semibold">
                        Drop your spreadsheet here
                      </p>

                      <p className="mt-1 text-sm text-[#777772]">
                        or click to choose a file
                      </p>

                      <p className="mt-4 text-xs text-[#92928d]">
                        CSV or XLSX · Maximum 25 MB
                      </p>
                    </label>
                )}
              </div>

              {error ? (
                  <div
                      className="mt-3 rounded-xl border border-[#efc8c3] bg-[#fff4f2] px-4 py-3 text-sm text-[#a42a20]"
                      role="alert"
                  >
                    {error}
                  </div>
              ) : null}

              <button
                  type="submit"
                  disabled={!file || uploadState === "uploading"}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#191918] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#d4d4cf] disabled:text-[#8b8b86]"
              >
                {uploadState === "uploading" ? (
                    <>
                      <SpinnerIcon className="size-4 animate-spin" />
                      Reading your spreadsheet
                    </>
                ) : (
                    <>
                      Analyze dataset
                      <ArrowIcon className="size-4" />
                    </>
                )}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-[#92928d]">
                Your spreadsheet is processed by the secure
                server-side ReportForge application.
              </p>
            </form>
          </section>

          <section
              id="how-it-works"
              className="border-y border-black/8 bg-white"
          >
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#2457e6]">
                  How it works
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                  A report you can understand immediately.
                </h2>

                <p className="mt-4 text-base leading-7 text-[#696965]">
                  ReportForge keeps complex calculations behind
                  the scenes and presents the result as a short,
                  evidence-backed business brief.
                </p>
              </div>

              <div className="mt-11 grid gap-px overflow-hidden rounded-[20px] border border-black/10 bg-black/10 md:grid-cols-3">
                <Step
                    number="01"
                    title="Connect the data"
                    description="Upload a spreadsheet and confirm which columns represent dates, customers, products, revenue, and costs."
                />

                <Step
                    number="02"
                    title="Review the findings"
                    description="See performance, customer risk, product movement, concentration, data quality, and opportunities."
                />

                <Step
                    number="03"
                    title="Act and export"
                    description="Follow prioritized recommendations and download an auditable Excel report for your team."
                />
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-[#83837e] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
            <p>© 2026 ReportForge</p>

            <p>
              Business reporting without the busywork.
            </p>
          </div>
        </footer>
      </div>
  );
}

function Feature({
                   title,
                   description,
                 }: {
  title: string;
  description: string;
}) {
  return (
      <div className="border-l border-black/12 pl-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#777772]">
          {description}
        </p>
      </div>
  );
}

function Step({
                number,
                title,
                description,
              }: {
  number: string;
  title: string;
  description: string;
}) {
  return (
      <article className="bg-white p-6 sm:p-8">
        <p className="font-mono text-xs font-semibold text-[#2457e6]">
          {number}
        </p>

        <h3 className="mt-8 text-lg font-semibold tracking-[-0.025em]">
          {title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-[#696965]">
          {description}
        </p>
      </article>
  );
}

function UploadIcon(
    props: SVGProps<SVGSVGElement>,
) {
  return (
      <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          {...props}
      >
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </svg>
  );
}

function FileIcon(
    props: SVGProps<SVGSVGElement>,
) {
  return (
      <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          {...props}
      >
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
  );
}

function ArrowIcon(
    props: SVGProps<SVGSVGElement>,
) {
  return (
      <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          {...props}
      >
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </svg>
  );
}

function CloseIcon(
    props: SVGProps<SVGSVGElement>,
) {
  return (
      <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          {...props}
      >
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
      </svg>
  );
}

function SpinnerIcon(
    props: SVGProps<SVGSVGElement>,
) {
  return (
      <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          {...props}
      >
        <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="3"
            opacity="0.25"
        />
        <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
        />
      </svg>
  );
}