"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

import {
    DailyCommitChart,
    DailyLineChangesChart,
    type DailyCommitDatum,
    type DailyLineChangesDatum,
} from "@/components/charts";
import { KPICardGroup, type KPIEntry } from "@/components/kpi-card-group";
import {
    ProjectContributionsCard,
    type ProjectContribution,
} from "@/components/project-contributions-card";
import {
    getUserPerformancePerformanceUsersUserIdGet,
    type GetUserPerformancePerformanceUsersUserIdGetResponse,
} from "@/client";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";

const numberFormatter = new Intl.NumberFormat();

type OverviewTabProps = {
    userId: number;
    username?: string;
    onErrorChange?: (message: string | null) => void;
    dateRange?: DateRange;
};

export default function OverviewTab({
    userId,
    username,
    onErrorChange,
    dateRange,
}: OverviewTabProps) {
    const [performance, setPerformance] =
        useState<GetUserPerformancePerformanceUsersUserIdGetResponse | null>(
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
            setLoading(false);
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
                const res = await getUserPerformancePerformanceUsersUserIdGet({
                    signal: controller.signal,
                    path: { user_id: userId },
                    query: {
                        start_date: startDate,
                        end_date: endDate,
                    },
                });

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
                        "We could not load performance data. Please try again.";
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
                            : "Unexpected error while loading performance data.";
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
    }, [endDate, onErrorChange, setGitlabTokenFailed, startDate, userId]);

    const commitChartData = useMemo<DailyCommitDatum[]>(() => {
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

    const lineChangesData = useMemo<DailyLineChangesDatum[]>(() => {
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

    const projects = useMemo<ProjectContribution[]>(() => {
        if (!performance?.project_performances?.length) {
            return [];
        }
        return performance.project_performances.map((project) => ({
            project_id: project.id,
            project_name: project.name,
            project_path_name: project.path_with_namespace,
            avatar_url: project.avatar_url ?? null,
            web_url: project.web_url,
            total_commits: project.commits,
            total_additions: project.additions,
            total_deletions: project.deletions,
            total_changes: project.changes,
            total_mr_contributed: project.mr_contributed,
            merge_requests: (project.merge_requests ?? []).map((mr) => {
                const iidValue = Number.parseInt(mr.iid, 10);
                return {
                    iid: Number.isFinite(iidValue) ? iidValue : 0,
                    title: mr.title,
                    description: mr.description,
                    web_url: mr.webUrl,
                    state: mr.state,
                    created_at: mr.created_at,
                    total_commits: mr.total_commits,
                    total_additions: mr.total_additions,
                    total_deletions: mr.total_deletions,
                };
            }),
        }));
    }, [performance?.project_performances]);

    const kpiEntries = useMemo<Record<string, KPIEntry>>(() => {
        if (!performance) {
            return {} as Record<string, KPIEntry>;
        }
        const totalDays = commitChartData.length || 1;
        const activeDays = commitChartData.filter(
            (day) => day.commits > 0,
        ).length;
        const totalAdditions = performance.additions;
        const totalDeletions = performance.deletions;

        return {
            totalCommits: {
                name: "Total Commits",
                description: "Total number of commits within this period.",
                value: numberFormatter.format(performance.commits ?? 0),
            },
            totalLinesChanges: {
                name: "Total Line Changes",
                description: "Lines added and removed across repositories.",
                value: (
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600 font-medium">
                            +{numberFormatter.format(totalAdditions)}
                        </span>
                        <span className="text-red-600 font-medium">
                            -{numberFormatter.format(totalDeletions)}
                        </span>
                        <span className="text-muted-foreground">
                            ({numberFormatter.format(performance.changes ?? 0)})
                        </span>
                    </div>
                ),
            },
            averageCommitsPerDay: {
                name: "Avg. Commits/Day",
                description: "Average commits recorded for each day.",
                value: (performance.commits / totalDays).toFixed(2),
            },
            projectsContributedTo: {
                name: "Projects Contributed To",
                description: "Unique repositories touched during the window.",
                value: numberFormatter.format(projects.length),
            },
            activeDays: {
                name: "Active Days",
                description: "Days with at least one commit recorded.",
                value: numberFormatter.format(activeDays),
            },
            approvalsGiven: {
                name: "Approvals",
                description: "Merge request approvals authored.",
                value: numberFormatter.format(performance.approvals_given ?? 0),
            },
            reviewMergeRequests: {
                name: "Reviewed MRs",
                description: "Merge requests reviewed.",
                value: numberFormatter.format(
                    performance.review_merge_requests ?? 0,
                ),
            },
            reviewComments: {
                name: "Review Comments",
                description: "Comments made of type review.",
                value: numberFormatter.format(performance.review_comments ?? 0),
            },
            notesAuthored: {
                name: "Notes Authored",
                description: "General comments authored.",
                value: numberFormatter.format(performance.notes_authored ?? 0),
            },
        };
    }, [commitChartData, performance, projects.length]);

    const showEmptyState =
        !loading && !performance && !error && !noRangeSelected;

    return (
        <div className="space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                    Overview insights for{" "}
                    <span className="font-semibold text-foreground">
                        {username ? `@${username}` : `user #${userId}`}
                    </span>{" "}
                    covering the past week.
                </p>
                <p>
                    Track commits, line changes, and project activity across
                    GitLab to understand contribution impact.
                </p>
            </div>

            {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {noRangeSelected && (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                    Select a week using the picker above to view performance
                    data.
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center gap-2 rounded-2xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading performance data
                </div>
            )}

            {performance && !loading ? (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <DailyCommitChart data={commitChartData} />
                        <DailyLineChangesChart data={lineChangesData} />
                    </div>
                    <KPICardGroup kpis={kpiEntries} />
                    <ProjectContributionsCard
                        projects={projects}
                        userId={userId}
                        emptyLabel="No project contributions recorded for this period."
                    />
                </>
            ) : null}

            {showEmptyState && (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                    No performance data available for this user in the selected
                    range.
                </div>
            )}
        </div>
    );
}
