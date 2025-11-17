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
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

export type DailyProjectTimespentDatum = {
    date: string | Date;
    project: string;
    hours: number;
};

export type DailyProjectTimespentChartProps = {
    data: DailyProjectTimespentDatum[];
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

const colorPalette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
] as const;

export function DailyProjectTimespentChart({
    data,
    title = "Daily time allocation",
    description = "Stacked view of hours logged per project each day.",
    emptyLabel = "No tracked time for this period.",
}: DailyProjectTimespentChartProps) {
    const { chartData, projectEntries, chartConfig, hasHours } = useMemo(() => {
        type ChartAccumulator = {
            label: string;
            tooltipLabel: string;
            timestamp: number;
            values: Record<string, number>;
        };

        const dateBuckets = new Map<string, ChartAccumulator>();
        const projectKeyMap = new Map<string, string>();

        let projectIndex = 0;
        let hasHours = false;

        const getProjectKey = (projectName: string) => {
            if (!projectKeyMap.has(projectName)) {
                projectKeyMap.set(projectName, `project-${projectIndex++}`);
            }
            return projectKeyMap.get(projectName)!;
        };

        data.forEach((entry) => {
            const hours = Math.max(0, Number(entry.hours) || 0);

            if (hours <= 0) {
                return;
            }

            hasHours = true;

            const projectName = entry.project?.trim() || "Unlabeled project";
            const dateValue =
                entry.date instanceof Date ? entry.date : new Date(entry.date);
            const isValidDate = !Number.isNaN(dateValue.getTime());
            const label = isValidDate
                ? shortDateFormatter.format(dateValue)
                : String(entry.date);
            const tooltipLabel = isValidDate
                ? fullDateFormatter.format(dateValue)
                : label;
            const dateKey = isValidDate
                ? dateValue.toISOString().split("T")[0]
                : label;

            const bucket =
                dateBuckets.get(dateKey) ??
                (() => {
                    const initial: ChartAccumulator = {
                        label,
                        tooltipLabel,
                        timestamp: isValidDate
                            ? dateValue.getTime()
                            : Number.MAX_SAFE_INTEGER,
                        values: {},
                    };
                    dateBuckets.set(dateKey, initial);
                    return initial;
                })();

            const projectKey = getProjectKey(projectName);
            bucket.values[projectKey] =
                (bucket.values[projectKey] ?? 0) + hours;
        });

        const projectEntries = Array.from(projectKeyMap.entries());
        const chartData = Array.from(dateBuckets.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((bucket) => {
                const values = projectEntries.reduce<Record<string, number>>(
                    (acc, [, projectKey]) => {
                        acc[projectKey] = Number(
                            bucket.values[projectKey] ?? 0,
                        );
                        return acc;
                    },
                    {},
                );

                return {
                    label: bucket.label,
                    tooltipLabel: bucket.tooltipLabel,
                    ...values,
                };
            });

        const chartConfig: ChartConfig = projectEntries.reduce(
            (acc, [projectName, projectKey], index) => {
                acc[projectKey] = {
                    label: projectName,
                    color: colorPalette[index % colorPalette.length],
                };
                return acc;
            },
            {} as ChartConfig,
        );

        return {
            chartData,
            projectEntries,
            chartConfig,
            hasHours,
        };
    }, [data]);

    const hasData = hasHours && chartData.length > 0;

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
                        config={chartConfig}
                        className="h-72 w-full aspect-auto"
                    >
                        <BarChart data={chartData} stackOffset="none">
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
                                width={32}
                                allowDecimals
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
                                                "Time spent"
                                            );
                                        }}
                                    />
                                }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            {projectEntries.map(([, projectKey], index) => {
                                const isTopLayer =
                                    index === projectEntries.length - 1;
                                return (
                                    <Bar
                                        key={projectKey}
                                        dataKey={projectKey}
                                        stackId="hours"
                                        fill={`var(--color-${projectKey})`}
                                        radius={
                                            isTopLayer
                                                ? [6, 6, 0, 0]
                                                : [0, 0, 0, 0]
                                        }
                                    />
                                );
                            })}
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
