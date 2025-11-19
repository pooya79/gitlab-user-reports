"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    listProjectsGitlabProjectsGet,
    listGitlabUsersUsersGet,
    type ProjectsResponse,
    type GitLabUser,
} from "@/client";
import { cn } from "@/lib/utils";
import {
    ExternalLink,
    Filter,
    GitBranch,
    Loader2,
    Search,
    UserCircle2,
    Users,
    ChartColumnBig,
    Mail,
    ShieldCheck,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

const PER_PAGE = 20;

type Project = ProjectsResponse & {
    tag_list?: string[];
    topics?: string[];
    avatar_url?: string | null;
};

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<"projects" | "users">("users");
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<GitLabUser[]>([]);
    const [projectPage, setProjectPage] = useState(1);
    const [projectHasMore, setProjectHasMore] = useState(true);
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState<string | null>(null);
    const [projectSearchTerm, setProjectSearchTerm] = useState("");
    const [projectDebouncedSearch, setProjectDebouncedSearch] = useState("");
    const [membershipOnly, setMembershipOnly] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [userHasMore, setUserHasMore] = useState(true);
    const [userLoading, setUserLoading] = useState(false);
    const [userError, setUserError] = useState<string | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [userDebouncedSearch, setUserDebouncedSearch] = useState("");
    const [humansOnly, setHumansOnly] = useState(true);
    const projectQueryKeyRef = useRef<string | null>(null);
    const userQueryKeyRef = useRef<string | null>(null);
    const { setFailed } = useGitlabTokenStore();

    useEffect(() => {
        const handle = setTimeout(() => {
            setProjectDebouncedSearch(projectSearchTerm.trim());
        }, 400);
        return () => clearTimeout(handle);
    }, [projectSearchTerm]);

    useEffect(() => {
        const handle = setTimeout(() => {
            setUserDebouncedSearch(userSearchTerm.trim());
        }, 400);
        return () => clearTimeout(handle);
    }, [userSearchTerm]);

    useEffect(() => {
        setProjects([]);
        setProjectPage(1);
        setProjectHasMore(true);
        projectQueryKeyRef.current = null;
    }, [projectDebouncedSearch, membershipOnly]);

    useEffect(() => {
        setUsers([]);
        setUserPage(1);
        setUserHasMore(true);
        userQueryKeyRef.current = null;
    }, [userDebouncedSearch, humansOnly]);

    useEffect(() => {
        if (activeTab !== "projects") {
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
                        setFailed(true);
                        return;
                    }
                    if (detail === "login_required") {
                        clearAccessToken();
                    }
                    setProjectError(
                        detail ||
                            "We could not load projects. Please try again."
                    );
                    setProjectHasMore(false);
                    return;
                }

                const data = (res.data as Project[]) ?? [];
                setProjects((prev) =>
                    projectPage === 1 ? data : [...prev, ...data]
                );
                setProjectHasMore(data.length === PER_PAGE);
                projectQueryKeyRef.current = queryKey;
            } catch (err) {
                if (!controller.signal.aborted) {
                    setProjectError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading projects."
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setProjectLoading(false);
                }
            }
        };

        fetchProjects();

        return () => controller.abort();
    }, [
        activeTab,
        projectPage,
        projectDebouncedSearch,
        membershipOnly,
        projects.length,
        setFailed,
    ]);

    useEffect(() => {
        if (activeTab !== "users") {
            return;
        }

        const controller = new AbortController();
        const queryKey = [
            userPage,
            userDebouncedSearch || "",
            humansOnly ? "humans" : "all",
        ].join("-");

        if (userQueryKeyRef.current === queryKey && users.length > 0) {
            return;
        }

        const fetchUsers = async () => {
            setUserLoading(true);
            setUserError(null);

            try {
                const res = await listGitlabUsersUsersGet({
                    signal: controller.signal,
                    query: {
                        page: userPage,
                        per_page: PER_PAGE,
                        search: userDebouncedSearch || undefined,
                        humans: humansOnly,
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
                        return;
                    }
                    if (detail === "login_required") {
                        clearAccessToken();
                    }
                    setUserError(
                        detail || "We could not load users. Please try again."
                    );
                    setUserHasMore(false);
                    return;
                }

                const data = (res.data as GitLabUser[]) ?? [];
                setUsers((prev) =>
                    userPage === 1 ? data : [...prev, ...data]
                );
                setUserHasMore(data.length === PER_PAGE);
                userQueryKeyRef.current = queryKey;
            } catch (err) {
                if (!controller.signal.aborted) {
                    setUserError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading users."
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setUserLoading(false);
                }
            }
        };

        fetchUsers();

        return () => controller.abort();
    }, [
        activeTab,
        humansOnly,
        setFailed,
        userDebouncedSearch,
        userPage,
        users.length,
    ]);

    const handleProjectIntersect = useCallback(() => {
        setProjectPage((prev) => prev + 1);
    }, []);

    const handleUserIntersect = useCallback(() => {
        setUserPage((prev) => prev + 1);
    }, []);

    const projectLoadMoreRef = useInfiniteObserver({
        hasMore: projectHasMore,
        loading: projectLoading,
        onIntersect: handleProjectIntersect,
    });

    const userLoadMoreRef = useInfiniteObserver({
        hasMore: userHasMore,
        loading: userLoading,
        onIntersect: handleUserIntersect,
    });

    const projectVisibleCount = useMemo(
        () => projects.length,
        [projects.length]
    );
    const userVisibleCount = useMemo(() => users.length, [users.length]);
    const showProjectSkeleton =
        projectLoading && projects.length === 0 && !projectError;
    const showUserSkeleton = userLoading && users.length === 0 && !userError;

    return (
        <div className="min-h-screen bg-muted/30">
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
                <header className="flex flex-col gap-4 rounded-3xl border bg-background/80 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <ChartColumnBig className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                                GitLab reports
                            </p>
                            <p className="text-lg font-semibold leading-tight">
                                Operations workspace
                            </p>
                        </div>
                    </div>
                    <nav className="flex flex-wrap items-center gap-2">
                        <TabButton
                            label="Users"
                            icon={<Users className="size-4" />}
                            isActive={activeTab === "users"}
                            onClick={() => setActiveTab("users")}
                        />
                        <TabButton
                            label="Projects"
                            icon={<GitBranch className="size-4" />}
                            isActive={activeTab === "projects"}
                            onClick={() => setActiveTab("projects")}
                        />
                    </nav>
                    <div className="flex justify-end">
                        <UserAvatar />
                    </div>
                </header>

                {activeTab === "users" ? (
                    <section className="flex flex-col gap-6">
                        <Card className="border bg-background/80">
                            <CardHeader className="gap-2">
                                <CardTitle>People</CardTitle>
                                <CardDescription>
                                    Discover teammates across GitLab. Search by
                                    name or username and scroll to load more.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="Search by name or username..."
                                        className="pl-10"
                                        value={userSearchTerm}
                                        onChange={(event) =>
                                            setUserSearchTerm(
                                                event.target.value
                                            )
                                        }
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant={humansOnly ? "default" : "outline"}
                                    className={cn(
                                        "rounded-full",
                                        humansOnly &&
                                            "shadow-sm shadow-primary/30"
                                    )}
                                    onClick={() =>
                                        setHumansOnly((prev) => !prev)
                                    }
                                >
                                    <UserCircle2 className="size-4" />
                                    {humansOnly
                                        ? "Humans only"
                                        : "Include bots"}
                                </Button>
                            </CardContent>
                            <CardFooter className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span>
                                    Showing{" "}
                                    <span className="font-semibold text-foreground">
                                        {userVisibleCount}
                                    </span>{" "}
                                    user{userVisibleCount === 1 ? "" : "s"}
                                </span>
                                {!userHasMore && users.length > 0 && (
                                    <span>End of user list</span>
                                )}
                            </CardFooter>
                        </Card>

                        {userError && (
                            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {userError}
                            </div>
                        )}

                        {showUserSkeleton ? (
                            <UserSkeletonList />
                        ) : users.length === 0 ? (
                            <EmptyState
                                title="No users found"
                                description="Try using a different query or include bot accounts."
                            />
                        ) : (
                            <div className="space-y-3">
                                {users.map((user) => (
                                    <UserCard key={user.id} user={user} />
                                ))}
                            </div>
                        )}

                        {userLoading && users.length > 0 && (
                            <div className="flex items-center justify-center gap-3 rounded-full border bg-background/80 px-4 py-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Loading more users
                            </div>
                        )}

                        <div ref={userLoadMoreRef} />
                    </section>
                ) : (
                    <section className="flex flex-col gap-6">
                        <Card className="border bg-background/80">
                            <CardHeader className="gap-2">
                                <CardTitle>Projects</CardTitle>
                                <CardDescription>
                                    Search across GitLab and filter to the
                                    projects you are a member of. Results load
                                    as you scroll.
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
                                            setProjectSearchTerm(
                                                event.target.value
                                            )
                                        }
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant={
                                        membershipOnly ? "default" : "outline"
                                    }
                                    className={cn(
                                        "rounded-full",
                                        membershipOnly &&
                                            "shadow-sm shadow-primary/30"
                                    )}
                                    onClick={() =>
                                        setMembershipOnly((prev) => !prev)
                                    }
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
                                    project
                                    {projectVisibleCount === 1 ? "" : "s"}
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
                                description="Try adjusting your search keywords or removing the membership filter."
                            />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {projects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                    />
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
                )}
            </main>
        </div>
    );
}

function TabButton({
    icon,
    label,
    isActive,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant={isActive ? "secondary" : "ghost"}
            className={cn(
                "rounded-full px-4 py-2 text-sm",
                isActive && "shadow-sm"
            )}
            onClick={onClick}
        >
            {icon}
            {label}
        </Button>
    );
}

function UserCard({ user }: { user: GitLabUser }) {
    const joinedLabel = formatDate(user.created_at);
    const lastSeenLabel = user.last_sign_in_at
        ? formatDate(user.last_sign_in_at)
        : null;
    const email = user.email ?? user.public_email;
    const initials = getInitials(user.name, user.username);
    const router = useRouter();
    const navigateToUserPage = useCallback(() => {
        router.push(`/dashboard/users/${user.id}`);
    }, [router, user.id]);

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={navigateToUserPage}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigateToUserPage();
                }
            }}
            className="border cursor-pointer hover:shadow-lg bg-background/90 shadow-sm"
        >
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="size-14 border text-base font-semibold uppercase text-muted-foreground">
                        {user.avatar_url ? (
                            <AvatarImage
                                src={user.avatar_url}
                                alt={`${user.name} avatar`}
                            />
                        ) : null}
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-lg font-semibold leading-tight">
                            {user.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            @{user.username}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="capitalize">
                                {user.state}
                            </Badge>
                            {user.bot ? (
                                <Badge variant="secondary">Bot</Badge>
                            ) : (
                                <Badge variant="secondary">Human</Badge>
                            )}
                            {user.is_admin && (
                                <Badge className="inline-flex items-center gap-1">
                                    <ShieldCheck className="size-3.5" />
                                    Admin
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:items-end sm:text-right">
                    {email ? (
                        <p className="inline-flex items-center gap-1">
                            <Mail className="size-3.5" />
                            <span className="truncate">{email}</span>
                        </p>
                    ) : (
                        <p>No email on record</p>
                    )}
                    <p>Joined {joinedLabel}</p>
                    <p>
                        Last seen{" "}
                        {lastSeenLabel ? lastSeenLabel : "not available"}
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>ID #{user.id}</span>
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="inline-flex items-center gap-1"
                    onClick={() => {
                        window.open(user.web_url, "_blank", "noreferrer");
                    }}
                >
                    View profile
                    <ExternalLink className="size-3.5" />
                </Button>
            </CardFooter>
        </Card>
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
                                "noreferrer"
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
                (_, index) => `project-skeleton-${index}`
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

function UserSkeletonList() {
    return (
        <div className="space-y-3">
            {Array.from(
                { length: 5 },
                (_, index) => `user-skeleton-${index}`
            ).map((key) => (
                <div
                    key={key}
                    className="rounded-3xl border bg-background/60 p-4"
                >
                    <div className="flex animate-pulse flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-full bg-muted/60" />
                            <div className="space-y-2">
                                <div className="h-4 w-36 rounded-full bg-muted/50" />
                                <div className="h-3 w-24 rounded-full bg-muted/40" />
                            </div>
                        </div>
                        <div className="w-full space-y-2 sm:w-auto sm:text-right">
                            <div className="ml-auto h-3 w-48 rounded-full bg-muted/40" />
                            <div className="ml-auto h-3 w-32 rounded-full bg-muted/30" />
                        </div>
                    </div>
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

function getInitials(name: string, username: string) {
    const trimmed = name.trim();
    if (!trimmed) {
        return (username.slice(0, 2) || "??").toUpperCase();
    }
    const parts = trimmed.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    const fallback = (first + last).trim() || trimmed.slice(0, 2);
    return fallback.toUpperCase();
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
        [hasMore, loading, onIntersect]
    );
}
