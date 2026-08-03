import {
    compactMoney,
    signedMoney,
} from "@/lib/reportforge/professional-report/formatters";
import type { ReportBridgeItem } from "@/lib/reportforge/professional-report/types";

export function RevenueBridgeChart({
                                       items,
                                   }: {
    items: ReportBridgeItem[];
}) {
    if (items.length < 2) {
        return (
            <div className="report-empty-chart">
                Not enough comparable history to
                render a bridge.
            </div>
        );
    }

    const maximum = Math.max(
        1,
        ...items.map((item) =>
            Math.abs(item.value),
        ),
    );

    return (
        <div className="report-bridge">
            {items.map((item) => (
                <article
                    key={item.id}
                    className={`is-${item.kind}`}
                >
                    <strong>
                        {item.kind === "start" ||
                        item.kind === "end"
                            ? compactMoney(item.value)
                            : signedMoney(item.value)}
                    </strong>

                    <div>
                        <span
                            style={{
                                height: `${Math.max(
                                    12,
                                    (Math.abs(
                                            item.value,
                                        ) /
                                        maximum) *
                                    100,
                                )}%`,
                            }}
                        />
                    </div>

                    <small>{item.label}</small>
                </article>
            ))}
        </div>
    );
}
