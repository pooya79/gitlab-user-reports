"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
    getProjectMembersGitlabProjectsProjectIdMembersGet,
    type MembersResponse,
} from "@/client";
import { ArrowLeft, ExternalLink, Loader2, Search, Shield } from "lucide-react";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";

const PER_PAGE = 20;

type ProjectMembersClientProps = {
    projectId: number;
};

export default function ProjectMembersClient({
    projectId,
}: ProjectMembersClientProps) {
    const [members, setMembers] = useState<MembersResponse[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const lastQueryKeyRef = useRef<string | null>(null);
    const { setFailed } = useGitlabTokenStore();

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
        }, 400);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    useEffect(() => {
        setMembers([]);
        setPage(1);
        setHasMore(true);
        lastQueryKeyRef.current = null;
    }, [debouncedSearch]);

    useEffect(() => {
        if (!Number.isFinite(projectId)) {
            setError("Invalid project ID.");
            setHasMore(false);
            return;
        }
        const controller = new AbortController();
        const queryKey = [projectId, page, debouncedSearch || ""].join("-");

        if (lastQueryKeyRef.current === queryKey && members.length > 0) {
            return;
        }

        const fetchMembers = async () => {
            setLoading(true);
            setError(null);
            try {
                const res =
                    await getProjectMembersGitlabProjectsProjectIdMembersGet({
                        signal: controller.signal,
                        path: { project_id: projectId },
                        query: {
                            page,
                            per_page: PER_PAGE,
                            search: debouncedSearch || undefined,
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
                        setFailed(true);
                    }
                    if (detail === "login_required") {
                        clearAccessToken();
                    }
                    setError(
                        detail ||
                            "We could not load project members. Please try again.",
                    );
                    setHasMore(false);
                    return;
                }

                const data = (res.data as MembersResponse[]) ?? [];
                setMembers((prev) => (page === 1 ? data : [...prev, ...data]));
                setHasMore(data.length === PER_PAGE);
                lastQueryKeyRef.current = queryKey;
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading members.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchMembers();

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, page, debouncedSearch]);

    const handleIntersect = useCallback(() => {
        setPage((prev) => prev + 1);
    }, []);

    const loadMoreRef = useInfiniteObserver({
        hasMore,
        loading,
        onIntersect: handleIntersect,
    });

    const visibleCount = useMemo(() => members.length, [members.length]);
    const showSkeleton = loading && members.length === 0;

    if (!Number.isFinite(projectId)) {
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
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
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

                <Card>
                    <CardHeader className="gap-2">
                        <CardTitle>Project members</CardTitle>
                        <CardDescription>
                            Search by name or username. Members load as you
                            scroll.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search members..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(event) =>
                                    setSearchTerm(event.target.value)
                                }
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                            Showing{" "}
                            <span className="font-semibold text-foreground">
                                {visibleCount}
                            </span>{" "}
                            member{visibleCount === 1 ? "" : "s"}
                        </span>
                        {!hasMore && members.length > 0 && (
                            <span>End of member list</span>
                        )}
                    </CardFooter>
                </Card>

                {error && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {showSkeleton ? (
                    <MemberSkeletonList />
                ) : members.length === 0 ? (
                    <EmptyState
                        title="No members found"
                        description="Try another search term."
                    />
                ) : (
                    <section className="space-y-3">
                        {members.map((member) => (
                            <MemberRow
                                key={member.id}
                                member={member}
                                projectId={projectId}
                            />
                        ))}
                    </section>
                )}

                {loading && members.length > 0 && (
                    <div className="flex items-center justify-center gap-3 rounded-full border bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading more members
                    </div>
                )}

                <div ref={loadMoreRef} />
            </div>
        </div>
    );
}

function MemberRow({
    member,
    projectId,
}: {
    member: MembersResponse;
    projectId: number;
}) {
    const router = useRouter();
    const navigateToMember = useCallback(() => {
        void router.push(`/dashboard/projects/${projectId}/users/${member.id}`);
    }, [member.id, projectId, router]);

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={navigateToMember}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigateToMember();
                }
            }}
            className="w-full cursor-pointer border bg-background/90 shadow-sm transition hover:border-primary/40 hover:bg-background"
        >
            <CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-1 items-center gap-4">
                    {member.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={member.avatar_url}
                            alt={`${member.name} avatar`}
                            className="size-14 rounded-full border object-cover"
                        />
                    ) : (
                        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground">
                            <Shield className="size-5" />
                        </div>
                    )}
                    <div className="space-y-1">
                        <CardTitle className="text-base">
                            {member.name}
                        </CardTitle>
                        <CardDescription>@{member.username}</CardDescription>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{member.state}</Badge>
                            <Badge>{member.access_level_name}</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:items-end">
                    <span>ID: {member.id}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="inline-flex items-center gap-1"
                        asChild
                        onClick={(event) => event.stopPropagation()}
                    >
                        <a
                            href={member.web_url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            View profile
                            <ExternalLink className="size-3.5" />
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function MemberSkeletonList() {
    return (
        <div className="space-y-3">
            {Array.from(
                { length: 4 },
                (_, index) => `member-skeleton-${index}`,
            ).map((key) => (
                <div
                    key={key}
                    className="h-28 w-full rounded-2xl border bg-background/60"
                >
                    <div className="h-full w-full animate-pulse rounded-2xl bg-muted/40" />
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
