"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, ExternalLink, Loader2, Shield } from "lucide-react";

import {
    getProjectProjectsProjectIdGet,
    type ProjectsResponse,
} from "@/client";
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
import { WeekPicker } from "@/components/week-picker";
import { cn } from "@/lib/utils";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";
import OverviewTab from "./overview-tab";
import MembersTab from "./members-tab";
import AiTab from "./ai-tab";
import SettingsTab from "./settings";

type ProjectDashboardProps = {
    projectId: number;
};

type TabValue = "overview" | "members" | "ai" | "settings";

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
    const isValidProjectId = Number.isFinite(projectId);
    const [project, setProject] = useState<ProjectsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabValue>("overview");
    const [selectedWeek, setSelectedWeek] = useState<DateRange>(() =>
        getDefaultWeekRange(),
    );
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        if (!isValidProjectId) {
            setError("Invalid project ID.");
            setProject(null);
            return;
        }

        const controller = new AbortController();

        const fetchProject = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await getProjectProjectsProjectIdGet({
                    signal: controller.signal,
                    path: { project_id: projectId },
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
                            "We could not load this project. Please try again.",
                    );
                    setProject(null);
                    return;
                }

                setProject(res.data ?? null);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading this project.",
                    );
                    setProject(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchProject();

        return () => controller.abort();
    }, [isValidProjectId, projectId, setGitlabTokenFailed]);

    const createdAtLabel = useMemo(() => {
        if (!project?.created_at) {
            return "Created date unavailable";
        }
        const createdAt = new Date(project.created_at);
        if (Number.isNaN(createdAt.getTime())) {
            return "Created date unavailable";
        }
        return format(createdAt, "PPP");
    }, [project?.created_at]);

    const topicBadges = useMemo(() => {
        if (!project) {
            return [];
        }
        return [...project.tag_list, ...project.topics].filter(Boolean);
    }, [project]);

    const detailItems = useMemo(
        () =>
            !project
                ? []
                : [
                      { label: "Project ID", value: `#${project.id}` },
                      {
                          label: "Namespace",
                          value: project.name_with_namespace,
                      },
                      {
                          label: "Path",
                          value: project.path_with_namespace,
                      },
                      { label: "Created", value: createdAtLabel },
                  ],
        [createdAtLabel, project],
    );

    const tabOptions: Array<{ label: string; value: TabValue }> = [
        { label: "Overview", value: "overview" },
        { label: "Members", value: "members" },
        { label: "AI", value: "ai" },
        { label: "Settings", value: "settings" },
    ];

    const weekLabel = useMemo(() => {
        if (selectedWeek?.from && selectedWeek?.to) {
            return `${format(selectedWeek.from, "MMM d")} - ${format(
                selectedWeek.to,
                "MMM d",
            )}`;
        }
        return "This week";
    }, [selectedWeek]);

    const renderedTab = useMemo(() => {
        switch (activeTab) {
            case "members":
                return <MembersTab projectId={projectId} />;
            case "ai":
                return <AiTab projectId={projectId} />;
            case "settings":
                return <SettingsTab projectId={projectId} />;
            case "overview":
            default:
                return (
                    <OverviewTab
                        projectId={projectId}
                        weekLabel={weekLabel}
                        dateRange={selectedWeek}
                        onErrorChange={setOverviewError}
                    />
                );
        }
    }, [activeTab, projectId, selectedWeek, weekLabel]);

    const showSkeleton = loading && !project && !error;

    if (!isValidProjectId) {
        return (
            <div className="flex min-h-screen items-center justify-center px-6">
                <Card className="max-w-lg">
                    <CardHeader>
                        <CardTitle>Project not found</CardTitle>
                        <CardDescription>
                            The project ID provided is not valid.
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
                    <Badge className="w-fit">Project #{projectId}</Badge>
                </div>

                {showSkeleton ? (
                    <ProjectSummarySkeleton />
                ) : project ? (
                    <Card>
                        <CardContent className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="size-16">
                                    {project.avatar_url ? (
                                        <AvatarImage
                                            src={project.avatar_url}
                                            alt={`${project.name} avatar`}
                                        />
                                    ) : null}
                                    <AvatarFallback>
                                        <Shield className="size-5 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl">
                                        {project.name}
                                    </CardTitle>
                                    <CardDescription>
                                        {project.path_with_namespace}
                                    </CardDescription>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        {topicBadges.length > 0 ? (
                                            topicBadges.map((topic, index) => (
                                                <Badge
                                                    key={`${topic}-${index}`}
                                                    variant="outline"
                                                >
                                                    {topic}
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="secondary">
                                                No topics
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground md:items-end">
                                <span>
                                    {loading && (
                                        <Loader2 className="mr-2 inline size-3.5 animate-spin align-middle" />
                                    )}
                                    Created {createdAtLabel}
                                </span>
                                {project.web_url && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="inline-flex items-center gap-2"
                                        asChild
                                    >
                                        <a
                                            href={project.web_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open in GitLab
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
                            <CardTitle>Project details unavailable</CardTitle>
                            <CardDescription>
                                We could not retrieve this project right now.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}

                {error && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}
                {!error && overviewError && activeTab === "overview" && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {overviewError}
                    </div>
                )}

                <Card>
                    <CardHeader className="gap-2">
                        <CardTitle>Project workspace</CardTitle>
                        <CardDescription>
                            Switch between overview, members, AI, and settings
                            for this project.
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

                            {activeTab === "overview" && (
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
                            )}
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

function ProjectSummarySkeleton() {
    return (
        <Card aria-label="Loading project">
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
