"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProjectsGitlabProjectsGet, type ProjectsResponse } from "@/client";
import { cn } from "@/lib/utils";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, GitBranch, Loader2, Search, ExternalLink } from "lucide-react";

const PER_PAGE = 20;

type Project = ProjectsResponse & {
    tag_list?: string[];
    topics?: string[];
    avatar_url?: string | null;
};

interface ProjectsTabProps {
    isActive: boolean;
}

export default function ProjectsTab({ isActive }: ProjectsTabProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectPage, setProjectPage] = useState(1);
    const [projectHasMore, setProjectHasMore] = useState(true);
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState<string | null>(null);
    const [projectSearchTerm, setProjectSearchTerm] = useState("");
    const [projectDebouncedSearch, setProjectDebouncedSearch] = useState("");
    const [membershipOnly, setMembershipOnly] = useState(false);
    const projectQueryKeyRef = useRef<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        const handle = setTimeout(() => {
            setProjectDebouncedSearch(projectSearchTerm.trim());
        }, 400);
        return () => clearTimeout(handle);
    }, [projectSearchTerm]);

    useEffect(() => {
        setProjects([]);
        setProjectPage(1);
        setProjectHasMore(true);
        projectQueryKeyRef.current = null;
    }, [projectDebouncedSearch, membershipOnly]);

    useEffect(() => {
        if (!isActive) {
            return;
        }

        const controller = new AbortController();
        const queryKey = [
            projectPage,
            projectDebouncedSearch || "",
            membershipOnly ? "member" : "all",
        ].join("-");

        if (projectQueryKeyRef.current === queryKey && projects.length > 0) {
            return;
        }

        const fetchProjects = async () => {
            setProjectLoading(true);
            setProjectError(null);

            try {
                const res = await listProjectsGitlabProjectsGet({
                    signal: controller.signal,
                    query: {
                        page: projectPage,
                        per_page: PER_PAGE,
                        search: projectDebouncedSearch || undefined,
                        membership: membershipOnly || undefined,
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
                        return;
                    }
                    if (detail === "login_required") {
                        clearAccessToken();
                    }
                    setProjectError(
                        detail ||
                            "We could not load projects. Please try again.",
                    );
                    setProjectHasMore(false);
                    return;
                }

                const data = (res.data as Project[]) ?? [];
                setProjects((prev) =>
                    projectPage === 1 ? data : [...prev, ...data],
                );
                setProjectHasMore(data.length === PER_PAGE);
                projectQueryKeyRef.current = queryKey;
            } catch (err) {
                if (!controller.signal.aborted) {
                    setProjectError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading projects.",
                    );
                }
                setProjectHasMore(false);
            } finally {
                if (!controller.signal.aborted) {
                    setProjectLoading(false);
                }
            }
        };

        fetchProjects();

        return () => controller.abort();
    }, [
        isActive,
        membershipOnly,
        projectDebouncedSearch,
        projectPage,
        projects.length,
        setGitlabTokenFailed,
    ]);

    const handleProjectIntersect = useCallback(() => {
        if (!isActive) {
            return;
        }
        setProjectPage((prev) => prev + 1);
    }, [isActive]);

    const projectLoadMoreRef = useInfiniteObserver({
        hasMore: projectHasMore,
        loading: projectLoading,
        onIntersect: handleProjectIntersect,
    });

    const projectVisibleCount = useMemo(
        () => projects.length,
        [projects.length],
    );
    const showProjectSkeleton =
        projectLoading && projects.length === 0 && !projectError;

    return (
        <section className={cn("flex flex-col gap-6", !isActive && "hidden")}>
            <Card className="border bg-background/80">
                <CardHeader className="gap-2">
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>
                        Search across GitLab and filter to the projects you are
                        a member of. Results load as you scroll.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by name or namespace..."
                            className="pl-10"
                            value={projectSearchTerm}
                            onChange={(event) =>
                                setProjectSearchTerm(event.target.value)
                            }
                        />
                    </div>
                    <Button
                        type="button"
                        variant={membershipOnly ? "default" : "outline"}
                        className={cn(
                            "rounded-full",
                            membershipOnly && "shadow-sm shadow-primary/30",
                        )}
                        onClick={() => setMembershipOnly((prev) => !prev)}
                    >
                        <Filter className="size-4" />
                        {membershipOnly
                            ? "Showing member projects"
                            : "Filter to membership"}
                    </Button>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>
                        Showing{" "}
                        <span className="font-semibold text-foreground">
                            {projectVisibleCount}
                        </span>{" "}
                        project{projectVisibleCount === 1 ? "" : "s"}
                    </span>
                    {!projectHasMore && projects.length > 0 && (
                        <span>End of project list</span>
                    )}
                </CardFooter>
            </Card>

            {projectError && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {projectError}
                </div>
            )}

            {showProjectSkeleton ? (
                <ProjectSkeletonGrid />
            ) : projects.length === 0 ? (
                <EmptyState
                    title="No projects found"
                    description="Try adjusting your filters or use a different search query."
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                </div>
            )}

            {projectLoading && projects.length > 0 && (
                <div className="flex items-center justify-center gap-3 rounded-full border bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading more projects
                </div>
            )}

            <div ref={projectLoadMoreRef} />
        </section>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const tags = project.tag_list ?? [];
    const topics = project.topics ?? [];
    const createdAtLabel = formatDate(project.created_at);

    return (
        <Link
            href={`/dashboard/projects/${project.id}`}
            className="block focus-visible:outline-none"
        >
            <Card className="border bg-background/90 shadow-sm transition hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring">
                <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                            <CardTitle className="text-xl">
                                {project.name}
                            </CardTitle>
                            <CardDescription className="text-sm">
                                {project.name_with_namespace}
                            </CardDescription>
                        </div>
                        {project.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={project.avatar_url}
                                alt={`${project.name} avatar`}
                                className="size-14 rounded-xl border object-cover"
                            />
                        ) : (
                            <div className="flex size-14 items-center justify-center rounded-xl border text-muted-foreground">
                                <GitBranch className="size-5" />
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {topics.length > 0 || tags.length > 0 ? (
                            <>
                                {topics.map((topic) => (
                                    <Badge key={topic} variant="secondary">
                                        {topic}
                                    </Badge>
                                ))}
                                {tags.map((tag) => (
                                    <Badge key={tag} variant="outline">
                                        {tag}
                                    </Badge>
                                ))}
                            </>
                        ) : (
                            <span>No tags or topics added yet.</span>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Created {createdAtLabel}</span>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="inline-flex items-center gap-1"
                        onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            window.open(
                                project.web_url,
                                "_blank",
                                "noreferrer",
                            );
                        }}
                    >
                        Open in GitLab
                        <ExternalLink className="size-3.5" />
                    </Button>
                </CardFooter>
            </Card>
        </Link>
    );
}

function ProjectSkeletonGrid() {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {Array.from(
                { length: 4 },
                (_, index) => `project-skeleton-${index}`,
            ).map((key) => (
                <div
                    key={key}
                    className="h-60 rounded-3xl border bg-background/60"
                >
                    <div className="h-full animate-pulse rounded-3xl bg-muted/40" />
                </div>
            ))}
        </div>
    );
}

function EmptyState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-background/40 px-6 py-16 text-center">
            <p className="text-lg font-semibold">{title}</p>
            <p className="max-w-xl text-sm text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "date unavailable";
    }
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function useInfiniteObserver({
    hasMore,
    loading,
    onIntersect,
}: {
    hasMore: boolean;
    loading: boolean;
    onIntersect: () => void;
}) {
    const observerRef = useRef<IntersectionObserver | null>(null);
    return useCallback(
        (node: HTMLDivElement | null) => {
            if (loading || !hasMore) {
                return;
            }
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting) {
                    onIntersect();
                }
            });
            if (node) {
                observerRef.current.observe(node);
            }
        },
        [hasMore, loading, onIntersect],
    );
}
