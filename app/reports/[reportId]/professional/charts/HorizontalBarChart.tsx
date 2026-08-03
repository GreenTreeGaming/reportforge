import type { Ranking } from "@/lib/reportforge/professional-report/types";

export function HorizontalBarChart({
                                       items,
                                       limit = 8,
                                   }: {
    items: Ranking[];
    limit?: number;
}) {
    const visible = items.slice(0, limit);

    if (!visible.length) {
        return (
            <div className="report-empty-chart">
                No qualifying records were available.
            </div>
        );
    }

    const maximum = Math.max(
        1,
        ...visible.map((item) =>
            Math.abs(item.value),
        ),
    );

    return (
        <div className="report-bars">
            {visible.map((item) => (
                <article key={item.id}>
                    <header>
                        <span>{item.label}</span>
                        <strong>
                            {item.formattedValue}
                        </strong>
                    </header>

                    <i>
                        <span
                            style={{
                                width: `${Math.max(
                                    3,
                                    (Math.abs(
                                            item.value,
                                        ) /
                                        maximum) *
                                    100,
                                )}%`,
                            }}
                        />
                    </i>

                    <small>{item.detail}</small>
                </article>
            ))}
        </div>
    );
}
