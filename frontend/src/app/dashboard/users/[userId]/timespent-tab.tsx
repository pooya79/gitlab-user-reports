"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

import {
    ProjectTimespentCard,
    type ProjectTimelogs,
} from "@/components/project-timespent-card";
import {
    DailyProjectTimespentChart,
    type DailyProjectTimespentDatum,
} from "@/components/charts";
import {
    getTimeSpentStatisticsPerformanceusersUserIdTimeSpentGet,
    type GetTimeSpentStatisticsPerformanceusersUserIdTimeSpentGetResponse,
} from "@/client";
import { clearAccessToken } from "@/lib/auth";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";

type TimespentTabProps = {
    userId: string;
    username?: string;
    dateRange?: DateRange;
    onErrorChange?: (message: string | null) => void;
};

function getDefaultWeekRange(): DateRange {
    const today = new Date();
    return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
    };
}

export default function TimespentTab({
    userId,
    username,
    dateRange,
    onErrorChange,
}: TimespentTabProps) {
    const [timeSpent, setTimeSpent] =
        useState<GetTimeSpentStatisticsPerformanceusersUserIdTimeSpentGetResponse | null>(
            null,
        );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    const effectiveRange = useMemo<DateRange>(() => {
        if (dateRange?.from && dateRange?.to) {
            return dateRange;
        }
        return getDefaultWeekRange();
    }, [dateRange]);

    const startDate = effectiveRange?.from?.toISOString();
    const endDate = effectiveRange?.to?.toISOString();
    const showEmptyState = !loading && !timeSpent && !error;

    useEffect(() => {
        const numericUserId = Number.parseInt(userId, 10);
        if (!Number.isFinite(numericUserId)) {
            const message = "Invalid user id provided.";
            setError(message);
            onErrorChange?.(message);
            setTimeSpent(null);
            return;
        }
        if (!startDate || !endDate) {
            setTimeSpent(null);
            setError(null);
            onErrorChange?.(null);
            return;
        }

        const controller = new AbortController();

        const fetchTimeSpent = async () => {
            setLoading(true);
            setError(null);
            onErrorChange?.(null);

            try {
                const res =
                    await getTimeSpentStatisticsPerformanceusersUserIdTimeSpentGet(
                        {
                            signal: controller.signal,
                            path: { user_id: numericUserId },
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
                        "We could not load time spent data. Please try again.";
                    setError(message);
                    onErrorChange?.(message);
                    setTimeSpent(null);
                    return;
                }

                setTimeSpent(res.data ?? null);
                onErrorChange?.(null);
            } catch (err) {
                if (!controller.signal.aborted) {
                    const message =
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading time spent data.";
                    setError(message);
                    onErrorChange?.(message);
                    setTimeSpent(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchTimeSpent();

        return () => controller.abort();
    }, [
        endDate,
        onErrorChange,
        setGitlabTokenFailed,
        startDate,
        userId,
    ]);

    const chartData = useMemo<DailyProjectTimespentDatum[]>(() => {
        if (!timeSpent?.daily_project_time_spent?.length) {
            return [];
        }
        return timeSpent.daily_project_time_spent
            .map(([date, project, hours]) => ({
                date: new Date(date),
                project,
                hours,
            }))
            .filter(
                (entry) => !Number.isNaN(entry.date.getTime()) && entry.project,
            );
    }, [timeSpent?.daily_project_time_spent]);

    const projectTimelogs = useMemo<ProjectTimelogs[]>(() => {
        if (!timeSpent?.project_timelogs?.length) {
            return [];
        }
        return timeSpent.project_timelogs;
    }, [timeSpent?.project_timelogs]);

    return (
        <div className="space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                    Timelog insights for{" "}
                    <span className="font-semibold text-foreground">
                        {username ? `@${username}` : `user #${userId}`}
                    </span>{" "}
                    covering the selected week.
                </p>
                <p>
                    Review daily tracked hours across projects and inspect the
                    underlying time entries linked to issues or merge requests.
                </p>
            </div>

            {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading time spent data
                </div>
            ) : null}

            {timeSpent && !loading ? (
                <>
                    <DailyProjectTimespentChart data={chartData} />
                    <ProjectTimespentCard
                        projects={projectTimelogs}
                        emptyLabel="No time entries recorded for this period."
                    />
                </>
            ) : null}

            {showEmptyState ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                    No time spent data available for this user in the selected
                    range.
                </div>
            ) : null}
        </div>
    );
}
