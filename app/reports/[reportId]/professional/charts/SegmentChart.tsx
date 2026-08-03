import { money } from "@/lib/reportforge/professional-report/formatters";
import type { ReportModel } from "@/lib/reportforge/professional-report/types";

type Segment =
    ReportModel["customer"]["segments"][number];

export function SegmentChart({
                                 segments,
                             }: {
    segments: Segment[];
}) {
    const visible = [...segments]
        .sort(
            (left, right) =>
                right.revenue - left.revenue,
        )
        .slice(0, 8);

    if (!visible.length) {
        return (
            <div className="report-empty-chart">
                Customer segments were not available.
            </div>
        );
    }

    const maximum = Math.max(
        1,
        ...visible.map(
            (segment) => segment.revenue,
        ),
    );

    return (
        <div className="report-segments">
            {visible.map((segment) => (
                <article key={segment.id}>
                    <header>
                        <div>
                            <strong>
                                {segment.label}
                            </strong>
                            <small>
                                {segment.customers.toLocaleString()}{" "}
                                customers
                            </small>
                        </div>

                        <b>
                            {money(segment.revenue)}
                        </b>
                    </header>

                    <i>
                        <span
                            style={{
                                width: `${Math.max(
                                    3,
                                    (segment.revenue /
                                        maximum) *
                                    100,
                                )}%`,
                            }}
                        />
                    </i>
                </article>
            ))}
        </div>
    );
}
