import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type MergeRequestContribution = {
    iid: number;
    title: string;
    description: string;
    web_url: string;
    state: string;
    created_at: string;
    total_commits: number;
    total_additions: number;
    total_deletions: number;
};

export type ProjectContribution = {
    project_id: number;
    project_name: string;
    project_path_name: string;
    avatar_url?: string | null;
    web_url: string;
    total_commits: number;
    total_additions: number;
    total_deletions: number;
    total_changes: number;
    total_mr_contributed: number;
    merge_requests: MergeRequestContribution[];
};

const numberFormatter = new Intl.NumberFormat();

const formatDate = (value: string | Date) => {
    const dateValue = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
        return "Unknown date";
    }
    return format(dateValue, "PP");
};

const getInitial = (value: string) => value?.charAt(0)?.toUpperCase() ?? "?";

export type ProjectContributionsCardProps = {
    projects: ProjectContribution[];
    userId: number;
    emptyLabel?: string;
};

export function ProjectContributionsCard({
    projects,
    userId,
    emptyLabel = "No project contributions recorded yet.",
}: ProjectContributionsCardProps) {
    return (
        <Card className="border shadow-sm">
            <CardHeader>
                <CardTitle>Projects contributed to</CardTitle>
                <CardDescription>
                    Breakdown of repositories and merge requests this user
                    recently touched.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {projects.length ? (
                    <Accordion type="multiple" className="space-y-3">
                        {projects.map((project) => (
                            <AccordionItem
                                key={project.project_id}
                                value={`project-${project.project_id}`}
                                className="rounded-2xl border px-4 data-[state=open]:bg-muted/20"
                            >
                                <AccordionTrigger className="hover:no-underline gap-4 px-0 text-base">
                                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-12 border">
                                                {project.avatar_url ? (
                                                    <AvatarImage
                                                        src={project.avatar_url}
                                                        alt={
                                                            project.project_name
                                                        }
                                                    />
                                                ) : null}
                                                <AvatarFallback>
                                                    {getInitial(
                                                        project.project_name,
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="text-foreground truncate font-semibold">
                                                    {project.project_name}
                                                </p>
                                                <p className="text-muted-foreground text-sm">
                                                    {project.project_path_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-1 flex-wrap justify-end gap-4 text-sm text-muted-foreground">
                                            <span className="text-foreground font-semibold">
                                                {numberFormatter.format(
                                                    project.total_commits,
                                                )}{" "}
                                                commits
                                            </span>
                                            <span>
                                                +
                                                {numberFormatter.format(
                                                    project.total_additions,
                                                )}{" "}
                                                / -
                                                {numberFormatter.format(
                                                    project.total_deletions,
                                                )}
                                            </span>
                                            <span>
                                                {numberFormatter.format(
                                                    project.total_mr_contributed,
                                                )}{" "}
                                                MRs
                                            </span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-0">
                                    <div className="space-y-4 border-t pt-4">
                                        {project.merge_requests.length ? (
                                            <div className="space-y-3">
                                                {project.merge_requests.map(
                                                    (mr) => (
                                                        <div
                                                            key={`${project.project_id}-${mr.iid}`}
                                                            className="rounded-2xl border bg-muted/10 p-4"
                                                        >
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {
                                                                            mr.title
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Created{" "}
                                                                        {formatDate(
                                                                            mr.created_at,
                                                                        )}{" "}
                                                                        · MR #
                                                                        {mr.iid}
                                                                    </p>
                                                                </div>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="capitalize self-start"
                                                                >
                                                                    {mr.state}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                {mr.description}
                                                            </p>
                                                            <div className="flex flex-wrap justify-between pt-3 text-xs text-muted-foreground">
                                                                <div className="flex gap-4">
                                                                    <span>
                                                                        Commits:{" "}
                                                                        {numberFormatter.format(
                                                                            mr.total_commits,
                                                                        )}
                                                                    </span>
                                                                    <span>
                                                                        <span className="text-green-600">
                                                                            +
                                                                            {numberFormatter.format(
                                                                                mr.total_additions,
                                                                            )}
                                                                        </span>
                                                                        {" / "}
                                                                        <span className="text-red-600">
                                                                            -
                                                                            {numberFormatter.format(
                                                                                mr.total_deletions,
                                                                            )}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="px-0"
                                                                    asChild
                                                                >
                                                                    <a
                                                                        href={
                                                                            mr.web_url
                                                                        }
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                    >
                                                                        View MR
                                                                    </a>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No merge requests recorded for
                                                this project in the selected
                                                range.
                                            </p>
                                        )}
                                        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Explore repository insights or
                                                continue the investigation.
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a
                                                        href={project.web_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Open project
                                                    </a>
                                                </Button>
                                                <Button size="sm" asChild>
                                                    <Link
                                                        href={`/dashboard/projects/${project.project_id}/users/${userId}`}
                                                    >
                                                        More details
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {emptyLabel}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
