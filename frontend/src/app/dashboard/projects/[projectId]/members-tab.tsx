"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Shield } from "lucide-react";
import {
    getProjectMembersProjectsProjectIdMembersGet,
    type GetProjectMembersProjectsProjectIdMembersGetResponse,
} from "@/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";

type MembersTabProps = {
    projectId: number;
};

export default function MembersTab({ projectId }: MembersTabProps) {
    const isValidProjectId = Number.isFinite(projectId);
    const [members, setMembers] =
        useState<GetProjectMembersProjectsProjectIdMembersGetResponse>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        if (!isValidProjectId) {
            setError("Invalid project ID.");
            setMembers([]);
            return;
        }

        const controller = new AbortController();

        const fetchMembers = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await getProjectMembersProjectsProjectIdMembersGet({
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
                            "We could not load project members. Please try again.",
                    );
                    setMembers([]);
                    return;
                }

                setMembers(res.data ?? []);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading members.",
                    );
                    setMembers([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchMembers();

        return () => controller.abort();
    }, [isValidProjectId, projectId, setGitlabTokenFailed]);

    const sortedMembers = useMemo(
        () =>
            [...members].sort((a, b) => {
                const nameA = a.name?.toLowerCase() ?? "";
                const nameB = b.name?.toLowerCase() ?? "";
                return nameA.localeCompare(nameB);
            }),
        [members],
    );

    if (!isValidProjectId) {
        return (
            <TabPlaceholder
                title="Project not found"
                description="The project ID provided is not valid."
            />
        );
    }

    if (loading) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading project members...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
            </div>
        );
    }

    if (!sortedMembers.length) {
        return (
            <TabPlaceholder
                title="No members found"
                description="We could not find any members for this project."
            />
        );
    }

    return (
        <div className="space-y-4">
            {sortedMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
            ))}
        </div>
    );
}

function TabPlaceholder({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex min-h-[220px] flex-col justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-6 py-10">
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function MemberCard({
    member,
}: {
    member: NonNullable<GetProjectMembersProjectsProjectIdMembersGetResponse>[number];
}) {
    const initials = useMemo(
        () => getInitials(member.name, member.username),
        [member.name, member.username],
    );

    return (
        <Card className="overflow-hidden border bg-background/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="size-14 border text-base font-semibold uppercase text-muted-foreground">
                        {member.avatar_url ? (
                            <AvatarImage
                                src={member.avatar_url}
                                alt={`${member.name} avatar`}
                            />
                        ) : null}
                        <AvatarFallback>
                            {initials || <Shield className="size-5" />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                        <div>
                            <CardTitle className="text-lg leading-tight">
                                {member.name}
                            </CardTitle>
                            <CardDescription>
                                @{member.username}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className="capitalize">
                                {member.state}
                            </Badge>
                            <Badge>{member.access_level_name}</Badge>
                        </div>
                    </div>
                </div>
                <Button asChild size="sm" className="w-full sm:w-auto">
                    <Link href={`/dashboard/users/${member.id}`}>
                        More Details
                    </Link>
                </Button>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                    ID: {member.id}
                </span>
                {member.web_url ? (
                    <a
                        href={member.web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        Open in GitLab <ExternalLink className="size-3.5" />
                    </a>
                ) : null}
            </CardFooter>
        </Card>
    );
}

function getInitials(name?: string | null, username?: string | null) {
    const source = name || username || "";
    const parts = source.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase();
    }
    return `${(parts[0]?.[0] ?? "").toUpperCase()}${(
        parts[1]?.[0] ?? ""
    ).toUpperCase()}`;
}
