"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Loader2 } from "lucide-react";

import {
    DailyCommitChart,
    DailyLineChangesChart,
    type DailyCommitDatum,
    type DailyLineChangesDatum,
} from "@/components/charts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KPICardGroup, type KPIEntry } from "@/components/kpi-card-group";
import {
    getGeneralProjectPerformancePerformanceProjectsProjectIdGet,
    type GetGeneralProjectPerformancePerformanceProjectsProjectIdGetResponse,
} from "@/client";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";

type OverviewTabProps = {
    projectId: number;
    weekLabel: string;
    dateRange?: DateRange;
    onErrorChange?: (message: string | null) => void;
};

export default function OverviewTab({
    projectId,
    weekLabel,
    dateRange,
    onErrorChange,
}: OverviewTabProps) {
    const [performance, setPerformance] =
        useState<GetGeneralProjectPerformancePerformanceProjectsProjectIdGetResponse | null>(
            null,
        );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();
    const startDate = dateRange?.from?.toISOString();
    const endDate = dateRange?.to?.toISOString();
    const noRangeSelected = !startDate || !endDate;

    useEffect(() => {
        if (!startDate || !endDate) {
            setPerformance(null);
            setError(null);
            onErrorChange?.(null);
            return;
        }

        const controller = new AbortController();

        const fetchPerformance = async () => {
            setLoading(true);
            setError(null);
            onErrorChange?.(null);

            try {
                const res =
                    await getGeneralProjectPerformancePerformanceProjectsProjectIdGet(
                        {
                            signal: controller.signal,
                            path: { project_id: projectId },
                            query: {
                                start_date: startDate,
                                end_date: endDate,
                            },
                        },
                    );

                if (controller.signal.aborted) {
                    return;
                }

                if (res.error) {
                    const detail =
                        typeof res.error?.detail === "string"
                            ? res.error.detail
                            : (res.error as { detail?: string })?.detail;

                    if (detail === "gitlab_token_required") {
                        setGitlabTokenFailed(true);
                    }

                    if (detail === "login_required") {
                        clearAccessToken();
                    }

                    const message =
                        detail ||
                        "We could not load project performance. Please try again.";
                    setError(message);
                    onErrorChange?.(message);
                    setPerformance(null);
                    return;
                }

                setPerformance(res.data ?? null);
                onErrorChange?.(null);
            } catch (err) {
                if (!controller.signal.aborted) {
                    const message =
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading project performance.";
                    setError(message);
                    onErrorChange?.(message);
                    setPerformance(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchPerformance();

        return () => controller.abort();
    }, [endDate, onErrorChange, projectId, setGitlabTokenFailed, startDate]);

    const commitData = useMemo<DailyCommitDatum[]>(() => {
        if (!performance?.daily_commit_counts) {
            return [];
        }
        return Object.entries(performance.daily_commit_counts)
            .map(([date, commits]) => ({
                date: new Date(date),
                commits,
            }))
            .filter((entry) => !Number.isNaN(entry.date.getTime()))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [performance?.daily_commit_counts]);

    const lineChangeData = useMemo<DailyLineChangesDatum[]>(() => {
        if (!performance) {
            return [];
        }
        const keys = new Set<string>([
            ...Object.keys(performance.daily_additions ?? {}),
            ...Object.keys(performance.daily_deletions ?? {}),
        ]);
        return Array.from(keys)
            .map((date) => ({
                date: new Date(date),
                linesAdded: performance.daily_additions?.[date] ?? 0,
                linesDeleted: performance.daily_deletions?.[date] ?? 0,
            }))
            .filter((entry) => !Number.isNaN(entry.date.getTime()))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [performance]);

    const contributors = useMemo<ContributorStat[]>(() => {
        if (!performance?.contributors?.length) {
            return [];
        }
        return performance.contributors.map((contributor) => ({
            name: contributor.author_name,
            email: contributor.author_email,
            commits: contributor.commits,
            linesAdded: contributor.additions,
            linesDeleted: contributor.deletions,
            linesChanged: contributor.changes,
        }));
    }, [performance?.contributors]);

    const kpiEntries = useMemo<Record<string, KPIEntry>>(() => {
        if (!performance) {
            return {} as Record<string, KPIEntry>;
        }
        const totalAdditions = performance.additions ?? 0;
        const totalDeletions = performance.deletions ?? 0;
        const totalChanges = performance.changes ?? 0;

        return {
            totalCommits: {
                name: "Total Commits",
                description: "Commits recorded for this project.",
                value: performance.commits?.toString() ?? "0",
            },
            totalLines: {
                name: "Total Line Changes",
                description: "Lines added and removed in this window.",
                value: (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-emerald-600">
                            +{totalAdditions}
                        </span>
                        <span className="font-medium text-red-600">
                            -{totalDeletions}
                        </span>
                        <span className="text-muted-foreground">
                            ({totalChanges})
                        </span>
                    </div>
                ),
            },
            contributors: {
                name: "Contributors",
                description: "Unique commit authors.",
                value: contributors.length.toString(),
            },
        };
    }, [contributors.length, performance]);

    const showEmptyState =
        !loading && !performance && !error && !noRangeSelected;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">
                        Development activity
                    </p>
                    <h3 className="text-xl font-semibold">
                        Project #{projectId} · {weekLabel}
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Select a week to explore commits, line changes, and
                    contributor impact.
                </p>
            </div>

            {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {noRangeSelected && (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                    Select a week using the picker above to view project
                    performance.
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading project performance
                </div>
            )}

            {performance && !loading ? (
                <>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <DailyCommitChart data={commitData} />
                        <DailyLineChangesChart data={lineChangeData} />
                    </div>
                    <KPICardGroup kpis={kpiEntries} />
                    <Card className="border bg-background/90">
                        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Top contributors</CardTitle>
                                <CardDescription>
                                    Authors driving commits in this window.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="w-fit">
                                {contributors.length} contributors
                            </Badge>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {contributors.length > 0 ? (
                                contributors.map((contributor) => (
                                    <ContributorCard
                                        key={`${contributor.email}-${contributor.name}`}
                                        contributor={contributor}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                                    No contributor stats available for this
                                    range.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : null}

            {showEmptyState && (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                    No performance data available for this project in the
                    selected range.
                </div>
            )}
        </div>
    );
}

type ContributorStat = {
    name: string;
    email: string;
    commits: number;
    linesAdded: number;
    linesDeleted: number;
    linesChanged: number;
};

function ContributorCard({ contributor }: { contributor: ContributorStat }) {
    return (
        <div className="rounded-2xl border bg-background/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                        {contributor.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {contributor.email}
                    </p>
                </div>
                <Badge variant="secondary" className="rounded-full">
                    {contributor.commits} commits
                </Badge>
            </div>
            <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                    <StatPill
                        label="Added"
                        value={contributor.linesAdded}
                        tone="success"
                    />
                    <StatPill
                        label="Deleted"
                        value={contributor.linesDeleted}
                        tone="destructive"
                    />
                    <StatPill
                        label="Changed"
                        value={contributor.linesChanged}
                    />
                </div>
                <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span>Balance</span>
                    <span className="font-semibold text-foreground">
                        {contributor.linesAdded - contributor.linesDeleted} net
                    </span>
                </div>
            </div>
        </div>
    );
}

function StatPill({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone?: "success" | "destructive";
}) {
    const colorClass =
        tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "destructive"
              ? "text-red-600 dark:text-red-400"
              : "text-foreground";
    return (
        <div className="rounded-xl border bg-muted/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className={`text-sm font-semibold ${colorClass}`}>{value}</p>
        </div>
    );
}
