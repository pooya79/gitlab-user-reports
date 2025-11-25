"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { endOfWeek, format, formatDistanceToNow, startOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, ExternalLink, Loader2, Shield } from "lucide-react";

import { getGitlabUserApiUsersUserIdGet, type GitLabUser } from "@/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WeekPicker } from "@/components/week-picker";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";

import OverviewTab from "./overview-tab";
import TimespentTab from "./timespent-tab";
import AiTab from "./ai-tab";
import UserSettingsTab from "./settings-tab";

type UserPerformanceDashboardProps = {
    userId: number;
};

type TabValue = "overview" | "timelogs" | "ai" | "settings";

export default function UserPerformanceDashboard({
    userId,
}: UserPerformanceDashboardProps) {
    const isValidUserId = Number.isFinite(userId);
    const [user, setUser] = useState<GitLabUser | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabValue>("overview");
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [timelogError, setTimelogError] = useState<string | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<DateRange>(() =>
        getDefaultWeekRange(),
    );
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        if (!isValidUserId) {
            setError("Invalid user ID.");
            setUser(null);
            return;
        }

        const controller = new AbortController();

        const fetchUser = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await getGitlabUserApiUsersUserIdGet({
                    signal: controller.signal,
                    path: { user_id: userId },
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

                    setError(
                        detail ||
                            "We could not load this user. Please try again.",
                    );
                    setUser(null);
                    return;
                }

                setUser(res.data ?? null);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading this user.",
                    );
                    setUser(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchUser();

        return () => controller.abort();
    }, [isValidUserId, setGitlabTokenFailed, userId]);

    const createdAtLabel = useMemo(() => {
        if (!user?.created_at) {
            return "Created date unavailable";
        }
        const createdAt = new Date(user.created_at);
        if (Number.isNaN(createdAt.getTime())) {
            return "Created date unavailable";
        }
        return format(createdAt, "PPP");
    }, [user?.created_at]);

    const lastSignInLabel = useMemo(() => {
        if (!user?.last_sign_in_at) {
            return "No recent sign in recorded";
        }
        const lastSignIn = new Date(user.last_sign_in_at);
        if (Number.isNaN(lastSignIn.getTime())) {
            return "No recent sign in recorded";
        }
        return `Last active ${formatDistanceToNow(lastSignIn, {
            addSuffix: true,
        })}`;
    }, [user?.last_sign_in_at]);

    const detailItems = useMemo(
        () =>
            !user
                ? []
                : [
                      { label: "User ID", value: `#${user.id}` },
                      { label: "Username", value: `@${user.username}` },
                      { label: "Email", value: user.email ?? "Private" },
                      {
                          label: "Public email",
                          value: user.public_email ?? "Not set",
                      },
                      { label: "Created", value: createdAtLabel },
                      { label: "Last sign in", value: lastSignInLabel },
                  ],
        [createdAtLabel, lastSignInLabel, user],
    );

    const statusBadges = useMemo(() => {
        if (!user) {
            return [];
        }
        const statuses: Array<{
            label: string;
            variant: "default" | "secondary" | "outline";
        }> = [
            {
                label: user.state,
                variant: "outline",
            },
        ];
        if (user.bot) {
            statuses.push({ label: "Bot", variant: "secondary" });
        }
        if (user.is_admin) {
            statuses.push({ label: "Admin", variant: "default" });
        }
        return statuses;
    }, [user]);

    const tabOptions: Array<{ label: string; value: TabValue }> = [
        { label: "Overview", value: "overview" },
        { label: "Timelogs", value: "timelogs" },
        { label: "AI", value: "ai" },
        { label: "Settings", value: "settings" },
    ];

    const renderedTab = useMemo(() => {
        switch (activeTab) {
            case "timelogs":
                return (
                    <TimespentTab
                        userId={String(userId)}
                        username={user?.username}
                        dateRange={selectedWeek}
                        onErrorChange={setTimelogError}
                    />
                );
            case "settings":
                return (
                    <UserSettingsTab
                        userId={String(userId)}
                        username={user?.username}
                    />
                );
            case "ai":
                return <AiTab userId={String(userId)} />;
            case "overview":
            default:
                return (
                    <OverviewTab
                        userId={userId}
                        username={user?.username}
                        onErrorChange={setOverviewError}
                        dateRange={selectedWeek}
                    />
                );
        }
    }, [activeTab, selectedWeek, user?.username, userId]);

    const showSkeleton = loading && !user && !error;

    if (!isValidUserId) {
        return (
            <div className="flex min-h-screen items-center justify-center px-6">
                <Card className="max-w-lg">
                    <CardHeader>
                        <CardTitle>User not found</CardTitle>
                        <CardDescription>
                            The user ID provided is not valid.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/dashboard">Back to dashboard</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 pb-12 pt-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-fit gap-2"
                        asChild
                    >
                        <Link href="/dashboard">
                            <ArrowLeft className="size-4" />
                            Back to dashboard
                        </Link>
                    </Button>
                    <Badge className="w-fit">User #{userId}</Badge>
                </div>

                {showSkeleton ? (
                    <UserSummarySkeleton />
                ) : user ? (
                    <Card>
                        <CardContent className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="size-16">
                                    {user.avatar_url ? (
                                        <AvatarImage
                                            src={user.avatar_url}
                                            alt={`${user.name} avatar`}
                                        />
                                    ) : null}
                                    <AvatarFallback>
                                        <Shield className="size-5 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl">
                                        {user.name}
                                    </CardTitle>
                                    <CardDescription>
                                        @{user.username}
                                    </CardDescription>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        {statusBadges.map((badge, index) => (
                                            <Badge
                                                key={`${badge.label}-${index}`}
                                                variant={badge.variant}
                                            >
                                                {badge.label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground md:items-end">
                                <span className="inline-flex items-center gap-2">
                                    {loading && (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    )}
                                    {lastSignInLabel}
                                </span>
                                {user.web_url && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="inline-flex items-center gap-2"
                                        asChild
                                    >
                                        <a
                                            href={user.web_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open GitLab profile
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-6 border-t bg-muted/30 px-6 py-4 text-sm">
                            {detailItems.map((item) => (
                                <div key={item.label} className="space-y-0.5">
                                    <p className="text-muted-foreground">
                                        {item.label}
                                    </p>
                                    <p className="font-semibold text-foreground">
                                        {item.value}
                                    </p>
                                </div>
                            ))}
                        </CardFooter>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>User details unavailable</CardTitle>
                            <CardDescription>
                                We could not retrieve this user profile right
                                now.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}

                {error && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}
                {overviewError && !error && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {overviewError}
                    </div>
                )}
                {timelogError && !error && activeTab === "timelogs" && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {timelogError}
                    </div>
                )}

                <Card>
                    <CardHeader className="gap-2">
                        <CardTitle>Performance workspace</CardTitle>
                        <CardDescription>
                            Switch between overview, timelogs, and settings for
                            this teammate.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <nav className="flex flex-wrap gap-2">
                                {tabOptions.map((tab) => (
                                    <Button
                                        key={tab.value}
                                        type="button"
                                        variant={
                                            activeTab === tab.value
                                                ? "default"
                                                : "outline"
                                        }
                                        className={cn(
                                            "rounded-full px-5",
                                            activeTab === tab.value
                                                ? "shadow-sm"
                                                : "bg-background/80 text-muted-foreground hover:text-foreground",
                                        )}
                                        onClick={() => setActiveTab(tab.value)}
                                    >
                                        {tab.label}
                                    </Button>
                                ))}
                            </nav>

                            {/* Push this to the right */}
                            <div className="ml-auto">
                                <WeekPicker
                                    value={selectedWeek}
                                    onChange={(value) => {
                                        if (value?.from && value?.to) {
                                            setSelectedWeek(value);
                                        } else {
                                            setSelectedWeek(
                                                getDefaultWeekRange(),
                                            );
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div className="rounded-2xl border bg-background/80 p-5">
                            {renderedTab}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function UserSummarySkeleton() {
    return (
        <Card aria-label="Loading user profile">
            <CardContent className="flex animate-pulse flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="size-16 rounded-full bg-muted" />
                    <div className="space-y-3">
                        <div className="h-5 w-40 rounded bg-muted" />
                        <div className="h-4 w-28 rounded bg-muted" />
                        <div className="h-4 w-32 rounded bg-muted" />
                    </div>
                </div>
                <div className="h-4 w-32 rounded bg-muted" />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-6 border-t bg-muted/30 px-6 py-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`skeleton-detail-${index}`} className="space-y-2">
                        <div className="h-3 w-16 rounded bg-muted" />
                        <div className="h-4 w-24 rounded bg-muted" />
                    </div>
                ))}
            </CardFooter>
        </Card>
    );
}

function getDefaultWeekRange(): DateRange {
    const today = new Date();
    return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
    };
}
