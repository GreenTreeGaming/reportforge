import { compactMoney } from "@/lib/reportforge/professional-report/formatters";

export function TrendChart({
                               points,
                           }: {
    points: {
        id: string;
        label: string;
        value: number;
    }[];
}) {
    if (points.length < 2) {
        return (
            <div className="report-empty-chart">
                Not enough history to render a trend.
            </div>
        );
    }

    const width = 760;
    const height = 250;
    const padding = 46;
    const maximum = Math.max(
        1,
        ...points.map((point) => point.value),
    );
    const minimum = Math.min(
        0,
        ...points.map((point) => point.value),
    );
    const range = maximum - minimum || 1;

    const coordinates = points.map(
        (point, index) => ({
            ...point,
            x:
                padding +
                (index /
                    Math.max(1, points.length - 1)) *
                (width - padding * 2),
            y:
                20 +
                ((maximum - point.value) / range) *
                (height - 80),
        }),
    );

    const path = coordinates
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" ");

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="report-chart"
            role="img"
            aria-label="Monthly net revenue trend"
        >
            {[0, 0.25, 0.5, 0.75, 1].map(
                (ratio) => {
                    const y =
                        20 + ratio * (height - 80);
                    const value =
                        maximum - ratio * range;

                    return (
                        <g key={ratio}>
                            <line
                                x1={padding}
                                x2={width - padding}
                                y1={y}
                                y2={y}
                                className="report-chart-grid"
                            />
                            <text
                                x={padding - 8}
                                y={y + 4}
                                textAnchor="end"
                                className="report-chart-label"
                            >
                                {compactMoney(value)}
                            </text>
                        </g>
                    );
                },
            )}

            <path
                d={path}
                fill="none"
                stroke="var(--report-accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {coordinates.map((point) => (
                <circle
                    key={point.id}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill="#fff"
                    stroke="var(--report-accent)"
                    strokeWidth="3"
                >
                    <title>
                        {point.label}:{" "}
                        {compactMoney(point.value)}
                    </title>
                </circle>
            ))}
        </svg>
    );
}
