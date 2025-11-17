"use client";

import { useMemo } from "react";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
} from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

export type DailyLineChangesDatum = {
    date: string | Date;
    linesAdded: number;
    linesDeleted: number;
};

export type DailyLineChangesChartProps = {
    data: DailyLineChangesDatum[];
    title?: string;
    description?: string;
    emptyLabel?: string;
};

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
});

export function DailyLineChangesChart({
    data,
    title = "Daily line changes",
    description = "Lines added vs deleted over time.",
    emptyLabel = "No line changes recorded for this period.",
}: DailyLineChangesChartProps) {
    const chartData = useMemo(() => {
        return data.map((point) => {
            const dateValue =
                point.date instanceof Date ? point.date : new Date(point.date);
            const isValidDate = !Number.isNaN(dateValue.getTime());
            const label = isValidDate
                ? shortDateFormatter.format(dateValue)
                : String(point.date);
            const tooltipLabel = isValidDate
                ? fullDateFormatter.format(dateValue)
                : label;

            const additions = Math.max(0, Number(point.linesAdded) || 0);
            const deletions = Math.max(0, Number(point.linesDeleted) || 0);

            return {
                label,
                tooltipLabel,
                additions,
                deletions,
                net: additions - deletions,
            };
        });
    }, [data]);

    const hasData = chartData.length > 0;

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
            </CardHeader>
            {hasData ? (
                <CardContent>
                    <ChartContainer
                        config={{
                            additions: {
                                label: "Lines added",
                                color: "var(--chart-1)",
                            },
                            deletions: {
                                label: "Lines deleted",
                                color: "var(--chart-2)",
                            },
                            net: {
                                label: "Net change",
                                color: "var(--chart-3)",
                            },
                        }}
                        // className="h-72 w-full aspect-auto"
                    >
                        <ComposedChart data={chartData}>
                            <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                                width={16}
                            />
                            <ChartTooltip
                                cursor={{ fill: "var(--muted)" }}
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(_label, payload) => {
                                            const item = payload?.[0]
                                                ?.payload as
                                                | (typeof chartData)[number]
                                                | undefined;
                                            return (
                                                item?.tooltipLabel ??
                                                "Line changes"
                                            );
                                        }}
                                    />
                                }
                            />
                            <ChartLegend
                                verticalAlign="top"
                                content={<ChartLegendContent />}
                            />
                            <Bar
                                dataKey="additions"
                                fill="var(--color-additions)"
                                radius={[6, 6, 0, 0]}
                                name="Lines added"
                            />
                            <Bar
                                dataKey="deletions"
                                fill="var(--color-deletions)"
                                radius={[6, 6, 0, 0]}
                                name="Lines deleted"
                            />
                            <Line
                                type="monotone"
                                dataKey="net"
                                stroke="var(--color-net)"
                                strokeWidth={2}
                                dot={false}
                                name="Net change"
                            />
                        </ComposedChart>
                    </ChartContainer>
                </CardContent>
            ) : (
                <CardContent>
                    <div className="text-muted-foreground h-48 items-center justify-center text-center text-sm flex">
                        {emptyLabel}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
