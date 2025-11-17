"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

export type DailyCommitDatum = {
    date: string | Date;
    commits: number;
};

export type DailyCommitChartProps = {
    data: DailyCommitDatum[];
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

export function DailyCommitChart({
    data,
    title = "Daily commits",
    description = "Commit frequency for the selected time range.",
    emptyLabel = "No commit activity recorded for this period.",
}: DailyCommitChartProps) {
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
            return {
                ...point,
                label,
                tooltipLabel,
                commits: Number(point.commits) || 0,
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
                            commits: {
                                label: "Commits",
                                color: "var(--chart-1)",
                            },
                        }}
                    >
                        <BarChart data={chartData}>
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
                                        indicator="dot"
                                        labelFormatter={(_label, payload) => {
                                            const item = payload?.[0]
                                                ?.payload as
                                                | (typeof chartData)[number]
                                                | undefined;
                                            return item?.tooltipLabel ?? "Day";
                                        }}
                                    />
                                }
                            />
                            <Bar
                                dataKey="commits"
                                fill="var(--color-commits)"
                                radius={6}
                            />
                        </BarChart>
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
