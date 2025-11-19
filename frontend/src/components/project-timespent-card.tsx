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

type ProjectInfo = {
    id: number;
    name: string;
    avatar_url?: string | null;
    web_url: string;
    path_with_namespace: string;
    name_with_namespace: string;
};

type IssueInfo = {
    iid: string;
    title: string;
    webUrl: string;
    state: string;
    reference: string;
};

type MergeRequestInfo = {
    iid: string;
    title: string;
    webUrl: string;
    state: string;
    reference: string;
};

export type TimelogNode = {
    id: number;
    project: ProjectInfo;
    time_spent: number;
    spent_at: string;
    summary?: string | null;
    issue?: IssueInfo | null;
    merge_request?: MergeRequestInfo | null;
};

export type ProjectTimelogs = {
    project: ProjectInfo;
    timelogs: TimelogNode[];
    total_time_spent_hours: number;
};

export type ProjectTimespentCardProps = {
    projects: ProjectTimelogs[];
    emptyLabel?: string;
};

type TimelogTarget = {
    type: "Issue" | "Merge request";
    title: string;
    reference: string;
    state: string;
    webUrl: string;
};

const hourFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
});

const formatDateTime = (value: string) => {
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
        return "Unknown date";
    }
    return format(dateValue, "PPpp");
};

const formatDuration = (seconds: number) => {
    if (!seconds) {
        return "0m";
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (hours) {
        parts.push(`${hours}h`);
    }
    if (minutes) {
        parts.push(`${minutes}m`);
    }
    if (!parts.length) {
        parts.push("<1m");
    }
    return parts.join(" ");
};

const getInitials = (value?: string) => {
    if (!value) {
        return "?";
    }
    const [first = "", second = ""] = value.trim().split(/\s+/);
    if (!second) {
        return first.charAt(0).toUpperCase() || "?";
    }
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
};

const getTimelogTarget = (log: TimelogNode): TimelogTarget | null => {
    if (log.issue) {
        return {
            type: "Issue",
            title: log.issue.title,
            reference: log.issue.reference,
            state: log.issue.state,
            webUrl: log.issue.webUrl,
        };
    }
    if (log.merge_request) {
        return {
            type: "Merge request",
            title: log.merge_request.title,
            reference: log.merge_request.reference,
            state: log.merge_request.state,
            webUrl: log.merge_request.webUrl,
        };
    }
    return null;
};

export function ProjectTimespentCard({
    projects,
    emptyLabel = "No time entries captured for this period.",
}: ProjectTimespentCardProps) {
    return (
        <Card className="border shadow-sm">
            <CardHeader>
                <CardTitle>Time spent by project</CardTitle>
                <CardDescription>
                    Explore every timelog linked to issues or merge requests the
                    user worked on.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {projects.length ? (
                    <Accordion type="multiple" className="space-y-3">
                        {projects.map(
                            ({ project, timelogs, total_time_spent_hours }) => {
                                const accordionValue = `project-${project.id}`;
                                return (
                                    <AccordionItem
                                        key={accordionValue}
                                        value={accordionValue}
                                        className="rounded-2xl border px-4 data-[state=open]:bg-muted/20"
                                    >
                                        <AccordionTrigger className="hover:no-underline gap-4 px-0 text-base">
                                            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="size-12 border">
                                                        {project.avatar_url ? (
                                                            <AvatarImage
                                                                src={
                                                                    project.avatar_url
                                                                }
                                                                alt={
                                                                    project.name
                                                                }
                                                            />
                                                        ) : null}
                                                        <AvatarFallback>
                                                            {getInitials(
                                                                project.name,
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-foreground truncate font-semibold">
                                                            {project.name}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            {
                                                                project.path_with_namespace
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-1 flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
                                                    <span className="text-foreground font-semibold">
                                                        {hourFormatter.format(
                                                            total_time_spent_hours,
                                                        )}{" "}
                                                        hrs logged
                                                    </span>
                                                    <Badge variant="secondary">
                                                        {timelogs.length}{" "}
                                                        timelog
                                                        {timelogs.length === 1
                                                            ? ""
                                                            : "s"}
                                                    </Badge>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="px-0"
                                                        asChild
                                                    >
                                                        <a
                                                            href={
                                                                project.web_url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Open project
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 px-0 pb-4 pt-0">
                                            {timelogs.length ? (
                                                <div className="space-y-3">
                                                    {timelogs.map((log) => {
                                                        const target =
                                                            getTimelogTarget(
                                                                log,
                                                            );

                                                        return (
                                                            <div
                                                                key={log.id}
                                                                className="group rounded-2xl border bg-card/80 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                                                            >
                                                                {/* Header: type + state + time */}
                                                                <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Badge variant="outline">
                                                                            {target?.type ??
                                                                                "Standalone log"}
                                                                        </Badge>
                                                                        {target?.state ? (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="capitalize"
                                                                            >
                                                                                {
                                                                                    target.state
                                                                                }
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>

                                                                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                                                                        <span>
                                                                            {formatDateTime(
                                                                                log.spent_at,
                                                                            )}
                                                                        </span>
                                                                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono">
                                                                            {formatDuration(
                                                                                log.time_spent,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Target (issue/MR) block */}
                                                                {target ? (
                                                                    <div className="mt-3">
                                                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                                {
                                                                                    target.reference
                                                                                }
                                                                            </p>
                                                                            <span className="text-muted-foreground">
                                                                                •
                                                                            </span>
                                                                            <p className="font-semibold text-foreground">
                                                                                {
                                                                                    target.title
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <p className="mt-3 text-sm text-muted-foreground">
                                                                        This
                                                                        time
                                                                        entry is
                                                                        not
                                                                        linked
                                                                        to an
                                                                        issue or
                                                                        merge
                                                                        request.
                                                                    </p>
                                                                )}

                                                                {/* Summary */}
                                                                {log.summary ? (
                                                                    <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                                                                        {
                                                                            log.summary
                                                                        }
                                                                    </p>
                                                                ) : null}

                                                                {/* Footer: link */}
                                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                                                                    <span className="text-muted-foreground">
                                                                        Timelog
                                                                        ID:{" "}
                                                                        <span className="font-mono text-foreground">
                                                                            {
                                                                                log.id
                                                                            }
                                                                        </span>
                                                                    </span>

                                                                    {target?.webUrl ? (
                                                                        <Button
                                                                            variant="link"
                                                                            size="sm"
                                                                            className="px-0 text-xs"
                                                                            asChild
                                                                        >
                                                                            <a
                                                                                href={
                                                                                    target.webUrl
                                                                                }
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                            >
                                                                                View{" "}
                                                                                {target.type.toLowerCase()}
                                                                            </a>
                                                                        </Button>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    No time entries found for
                                                    this project in the selected
                                                    period.
                                                </p>
                                            )}
                                            <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    Total logged:{" "}
                                                    <span className="font-semibold text-foreground">
                                                        {hourFormatter.format(
                                                            total_time_spent_hours,
                                                        )}{" "}
                                                        hrs
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline">
                                                        {
                                                            project.name_with_namespace
                                                        }
                                                    </Badge>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <a
                                                            href={
                                                                project.web_url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Visit repository
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            },
                        )}
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
