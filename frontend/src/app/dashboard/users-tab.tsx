"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listGitlabUsersApiUsersGet, type GitLabUser } from "@/client";
import { cn } from "@/lib/utils";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";
import {
    Search,
    Loader2,
    UserCircle2,
    Mail,
    ShieldCheck,
    ExternalLink,
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PER_PAGE = 20;

interface UsersTabProps {
    isActive: boolean;
}

export default function UsersTab({ isActive }: UsersTabProps) {
    const [users, setUsers] = useState<GitLabUser[]>([]);
    const [userPage, setUserPage] = useState(1);
    const [userHasMore, setUserHasMore] = useState(true);
    const [userLoading, setUserLoading] = useState(false);
    const [userError, setUserError] = useState<string | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [userDebouncedSearch, setUserDebouncedSearch] = useState("");
    const [humansOnly, setHumansOnly] = useState(true);
    const userQueryKeyRef = useRef<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        const handle = setTimeout(() => {
            setUserDebouncedSearch(userSearchTerm.trim());
        }, 400);
        return () => clearTimeout(handle);
    }, [userSearchTerm]);

    useEffect(() => {
        setUsers([]);
        setUserPage(1);
        setUserHasMore(true);
        userQueryKeyRef.current = null;
    }, [userDebouncedSearch, humansOnly]);

    useEffect(() => {
        if (!isActive) {
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
                const res = await listGitlabUsersApiUsersGet({
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
                        setGitlabTokenFailed(true);
                        return;
                    }
                    if (detail === "login_required") {
                        clearAccessToken();
                    }
                    setUserError(
                        detail || "We could not load users. Please try again.",
                    );
                    setUserHasMore(false);
                    return;
                }

                const data = (res.data as GitLabUser[]) ?? [];
                setUsers((prev) =>
                    userPage === 1 ? data : [...prev, ...data],
                );
                setUserHasMore(data.length === PER_PAGE);
                userQueryKeyRef.current = queryKey;
            } catch (err) {
                if (!controller.signal.aborted) {
                    setUserError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading users.",
                    );
                }
                setUserHasMore(false);
            } finally {
                if (!controller.signal.aborted) {
                    setUserLoading(false);
                }
            }
        };

        fetchUsers();

        return () => controller.abort();
    }, [
        humansOnly,
        isActive,
        setGitlabTokenFailed,
        userDebouncedSearch,
        userPage,
        users.length,
    ]);

    const handleUserIntersect = useCallback(() => {
        if (!isActive) {
            return;
        }
        setUserPage((prev) => prev + 1);
    }, [isActive]);

    const userLoadMoreRef = useInfiniteObserver({
        hasMore: userHasMore,
        loading: userLoading,
        onIntersect: handleUserIntersect,
    });

    const userVisibleCount = useMemo(() => users.length, [users.length]);
    const showUserSkeleton = userLoading && users.length === 0 && !userError;

    return (
        <section className={cn("flex flex-col gap-6", !isActive && "hidden")}>
            <Card className="border bg-background/80">
                <CardHeader className="gap-2">
                    <CardTitle>People</CardTitle>
                    <CardDescription>
                        Discover teammates across GitLab. Search by name or
                        username and scroll to load more.
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
                                setUserSearchTerm(event.target.value)
                            }
                        />
                    </div>
                    <Button
                        type="button"
                        variant={humansOnly ? "default" : "outline"}
                        className={cn(
                            "rounded-full",
                            humansOnly && "shadow-sm shadow-primary/30",
                        )}
                        onClick={() => setHumansOnly((prev) => !prev)}
                    >
                        <UserCircle2 className="size-4" />
                        {humansOnly ? "Humans only" : "Include bots"}
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
        <Link href={`/dashboard/users/${user.id}`}>
            <Card className="border cursor-pointer hover:shadow-lg bg-background/90 shadow-sm">
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
        </Link>
    );
}

function UserSkeletonList() {
    return (
        <div className="space-y-3">
            {Array.from(
                { length: 5 },
                (_, index) => `user-skeleton-${index}`,
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
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
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
        [hasMore, loading, onIntersect],
    );
}
