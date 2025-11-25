"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listSchedulesApiSchedulerReportsGet,
    createScheduleApiSchedulerReportsPost,
    updateScheduleApiSchedulerReportsScheduleIdPut,
    deleteScheduleApiSchedulerReportsScheduleIdDelete,
    sendScheduleNowApiSchedulerReportsScheduleIdSendNowPost,
    listGitlabUsersApiUsersGet,
    getGitlabUserApiUsersUserIdGet,
    type ScheduledReportCreate,
    type ScheduledReportResponse,
    type ScheduledReportUpdate,
    type GitLabUser,
} from "@/client";
import { cn } from "@/lib/utils";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
import { clearAccessToken } from "@/lib/auth";
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
import { Label } from "@/components/ui/label";
import {
    CalendarClock,
    Check,
    Loader2,
    Mail,
    Pencil,
    Plus,
    Send,
    Trash2,
    UserSearch,
    X,
} from "lucide-react";

const DAY_OPTIONS = [
    { value: "mon", label: "Monday" },
    { value: "tue", label: "Tuesday" },
    { value: "wed", label: "Wednesday" },
    { value: "thu", label: "Thursday" },
    { value: "fri", label: "Friday" },
    { value: "sat", label: "Saturday" },
    { value: "sun", label: "Sunday" },
];

interface SchedulesTabProps {
    isActive: boolean;
}

export default function SchedulesTab({ isActive }: SchedulesTabProps) {
    const [schedules, setSchedules] = useState<ScheduledReportResponse[]>([]);
    const [userNames, setUserNames] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    const loadSchedules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await listSchedulesApiSchedulerReportsGet();
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
                setError(
                    detail ||
                        "We could not load schedules. Please try again later.",
                );
                setSchedules([]);
                return;
            }
            setSchedules((res.data as ScheduledReportResponse[]) ?? []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unexpected error loading schedules.",
            );
            setSchedules([]);
        } finally {
            setLoading(false);
        }
    }, [setGitlabTokenFailed]);

    useEffect(() => {
        if (!isActive) {
            return;
        }
        loadSchedules();
    }, [isActive, loadSchedules]);

    // Fetch user display names for loaded schedules
    useEffect(() => {
        const missing = schedules
            .map((s) => s.user_id)
            .filter((id) => !userNames[id]);
        if (!missing.length) return;

        const controller = new AbortController();
        (async () => {
            const updates: Record<number, string> = {};
            for (const id of missing) {
                try {
                    const res = await getGitlabUserApiUsersUserIdGet({
                        path: { user_id: id },
                        signal: controller.signal,
                    });
                    if (!res.error && res.data) {
                        const user = res.data as GitLabUser;
                        updates[id] = `${user.name} (@${user.username})`;
                    }
                } catch {
                    // ignore lookup failures
                }
            }
            if (!controller.signal.aborted && Object.keys(updates).length) {
                setUserNames((prev) => ({ ...prev, ...updates }));
            }
        })();

        return () => controller.abort();
    }, [schedules, userNames]);

    const handleCreate = async (
        payload: ScheduledReportCreate,
    ): Promise<boolean> => {
        setCreating(true);
        try {
            const res = await createScheduleApiSchedulerReportsPost({
                body: payload,
            });
            if (res.error) {
                const detail =
                    typeof res.error?.detail === "string"
                        ? res.error.detail
                        : (res.error as { detail?: string })?.detail;
                setError(detail || "Could not create schedule.");
                return false;
            }
            await loadSchedules();
            return true;
        } finally {
            setCreating(false);
        }
    };

    const handleUpdate = async (
        id: string,
        payload: ScheduledReportUpdate,
    ): Promise<boolean> => {
        setSavingId(id);
        try {
            const res = await updateScheduleApiSchedulerReportsScheduleIdPut({
                path: { schedule_id: id },
                body: payload,
            });
            if (res.error) {
                const detail =
                    typeof res.error?.detail === "string"
                        ? res.error.detail
                        : (res.error as { detail?: string })?.detail;
                setError(detail || "Could not update schedule.");
                return false;
            }
            await loadSchedules();
            setEditingId(null);
            return true;
        } finally {
            setSavingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await deleteScheduleApiSchedulerReportsScheduleIdDelete({
                path: { schedule_id: id },
            });
            await loadSchedules();
        } finally {
            setDeletingId(null);
        }
    };

    const handleSendNow = async (id: string) => {
        setSendingId(id);
        try {
            const res =
                await sendScheduleNowApiSchedulerReportsScheduleIdSendNowPost({
                    path: { schedule_id: id },
                });
            if (res.error) {
                const detail =
                    typeof res.error?.detail === "string"
                        ? res.error.detail
                        : (res.error as { detail?: string })?.detail;
                setError(detail || "Could not send schedule now.");
                return;
            }
            alert("Schedule queued successfully.");
        } finally {
            setSendingId(null);
        }
    };

    const visibleSchedules = useMemo(() => {
        return [...schedules].sort((a, b) => a.user_id - b.user_id);
    }, [schedules]);

    const showEmpty =
        !loading && !visibleSchedules.length && error === null && !showCreate;

    return (
        <section className={cn("flex flex-col gap-6", !isActive && "hidden")}>
            <Card className="border bg-background/80">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <CardTitle>Schedules</CardTitle>
                        <CardDescription>
                            Configure weekly email reports. Use the search to
                            pick a user, then set recipients and timing (UTC).
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        onClick={() => setShowCreate((prev) => !prev)}
                        className="gap-2 rounded-full"
                    >
                        {showCreate ? (
                            <X className="size-4" />
                        ) : (
                            <Plus className="size-4" />
                        )}
                        {showCreate ? "Close" : "Add schedule"}
                    </Button>
                </CardHeader>
                {showCreate && (
                    <CardContent>
                        <ScheduleForm
                            mode="create"
                            onSubmit={handleCreate}
                            submitting={creating}
                        />
                    </CardContent>
                )}
            </Card>

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-destructive">
                            Something went wrong
                        </CardTitle>
                        <CardDescription className="text-destructive/80">
                            {error}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadSchedules}
                            disabled={loading}
                        >
                            Retry
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {loading && (
                <Card className="border bg-background/60">
                    <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading schedules...
                    </CardContent>
                </Card>
            )}

            {showEmpty && (
                <EmptyState
                    title="No schedules yet"
                    description="Create your first scheduled report to send weekly performance and time-spent summaries."
                />
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {visibleSchedules.map((schedule) => {
                    const isEditing = editingId === schedule.id;
                    const isSaving = savingId === schedule.id;
                    const isSending = sendingId === schedule.id;
                    const isDeleting = deletingId === schedule.id;
                    const displayUser =
                        userNames[schedule.user_id] ||
                        `User #${schedule.user_id}`;
                    return (
                        <Card
                            key={schedule.id}
                            className="border bg-background/80 shadow-sm"
                        >
                            <CardHeader className="gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <CalendarClock className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <CardTitle className="text-base">
                                            {displayUser}
                                        </CardTitle>
                                        <CardDescription>
                                            {formatScheduleTime(schedule)}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                        {schedule.active ? "Active" : "Paused"}
                                    </Badge>
                                    {schedule.next_run_at && (
                                        <Badge variant="secondary">
                                            Next:{" "}
                                            {formatDateTime(
                                                schedule.next_run_at,
                                            )}
                                        </Badge>
                                    )}
                                    {schedule.last_sent_at && (
                                        <Badge variant="outline">
                                            Last sent:{" "}
                                            {formatDateTime(
                                                schedule.last_sent_at,
                                            )}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>

                            {!isEditing && (
                                <CardContent className="flex flex-col gap-3 text-sm">
                                    <RecipientRow
                                        label="To"
                                        emails={schedule.to}
                                    />
                                    {schedule.cc?.length ? (
                                        <RecipientRow
                                            label="CC"
                                            emails={schedule.cc}
                                        />
                                    ) : null}
                                    {schedule.bcc?.length ? (
                                        <RecipientRow
                                            label="BCC"
                                            emails={schedule.bcc}
                                        />
                                    ) : null}
                                    {schedule.subject && (
                                        <p className="text-muted-foreground">
                                            <span className="font-medium text-foreground">
                                                Subject:
                                            </span>{" "}
                                            {schedule.subject}
                                        </p>
                                    )}
                                    {schedule.last_error && (
                                        <p className="text-sm text-destructive">
                                            Last error: {schedule.last_error}
                                        </p>
                                    )}
                                </CardContent>
                            )}

                            {isEditing && (
                                <CardContent>
                                    <ScheduleForm
                                        mode="edit"
                                        initial={schedule}
                                        onSubmit={(data) =>
                                            handleUpdate(schedule.id, data)
                                        }
                                        submitting={isSaving}
                                        userLabel={displayUser}
                                    />
                                </CardContent>
                            )}

                            <CardFooter className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() =>
                                        setEditingId(
                                            isEditing ? null : schedule.id,
                                        )
                                    }
                                    disabled={isSending || isDeleting}
                                >
                                    <Pencil className="size-4" />
                                    {isEditing ? "Close" : "Edit"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleSendNow(schedule.id)}
                                    disabled={isSending || isDeleting}
                                >
                                    {isSending ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                    Send now
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 text-destructive"
                                    onClick={() => handleDelete(schedule.id)}
                                    disabled={isSending || isDeleting}
                                >
                                    {isDeleting ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="size-4" />
                                    )}
                                    Delete
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

function RecipientRow({ label, emails }: { label: string; emails: string[] }) {
    return (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Mail className="mt-0.5 size-4 text-primary" />
            <div className="flex flex-col gap-1">
                <span className="text-foreground">{label}</span>
                <div className="flex flex-wrap gap-1">
                    {emails.map((email) => (
                        <Badge key={email} variant="outline">
                            {email}
                        </Badge>
                    ))}
                </div>
            </div>
        </div>
    );
}

type ScheduleFormProps =
    | {
          mode: "create";
          submitting: boolean;
          onSubmit: (data: ScheduledReportCreate) => Promise<boolean>;
          initial?: undefined;
          userLabel?: undefined;
      }
    | {
          mode: "edit";
          submitting: boolean;
          onSubmit: (data: ScheduledReportUpdate) => Promise<boolean>;
          initial: ScheduledReportResponse;
          userLabel?: string;
      };

function ScheduleForm({
    mode,
    onSubmit,
    submitting,
    initial,
    userLabel,
}: ScheduleFormProps) {
    const [userId, setUserId] = useState<number | null>(
        initial?.user_id ?? null,
    );
    const [selectedUserLabel, setSelectedUserLabel] = useState<string>(
        userLabel ?? (initial ? `User #${initial.user_id}` : ""),
    );
    const [userQuery, setUserQuery] = useState("");
    const [userResults, setUserResults] = useState<GitLabUser[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [to, setTo] = useState(initial?.to?.join(", ") ?? "user@example.com");
    const [cc, setCc] = useState(initial?.cc?.join(", ") ?? "");
    const [bcc, setBcc] = useState(initial?.bcc?.join(", ") ?? "");
    const [subject, setSubject] = useState(initial?.subject ?? "");
    const [dayOfWeek, setDayOfWeek] = useState(initial?.day_of_week ?? "mon");
    const [hour, setHour] = useState(String(initial?.hour_utc ?? 7));
    const [minute, setMinute] = useState(String(initial?.minute_utc ?? 0));
    const [active, setActive] = useState(initial?.active ?? true);

    useEffect(() => {
        if (mode === "edit") {
            return;
        }
        if (!userQuery.trim()) {
            setUserResults([]);
            return;
        }
        const controller = new AbortController();
        const handle = setTimeout(async () => {
            setSearchingUsers(true);
            try {
                const res = await listGitlabUsersApiUsersGet({
                    signal: controller.signal,
                    query: {
                        search: userQuery.trim(),
                        per_page: 6,
                        page: 1,
                    },
                });
                if (controller.signal.aborted) return;
                if (!res.error && res.data) {
                    setUserResults(res.data as GitLabUser[]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSearchingUsers(false);
                }
            }
        }, 300);

        return () => {
            controller.abort();
            clearTimeout(handle);
        };
    }, [mode, userQuery]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);

        if (mode === "create" && !userId) {
            setFormError("Select a user for this schedule.");
            return;
        }
        const toList = splitEmails(to);
        if (!toList.length) {
            setFormError("Add at least one recipient in the To field.");
            return;
        }
        if (mode === "create") {
            const payload: ScheduledReportCreate = {
                user_id: userId as number,
                to: toList,
                cc: splitEmails(cc),
                bcc: splitEmails(bcc),
                subject: subject.trim() || undefined,
                day_of_week: dayOfWeek,
                hour_utc: Number(hour) || 0,
                minute_utc: Number(minute) || 0,
                active,
            };
            const ok = await onSubmit(payload);
            if (ok) {
                setUserId(null);
                setSelectedUserLabel("");
                setUserQuery("");
                setUserResults([]);
            }
            return;
        }

        const updatePayload: ScheduledReportUpdate = {
            to: toList,
            cc: splitEmails(cc),
            bcc: splitEmails(bcc),
            subject: subject.trim() || undefined,
            day_of_week: dayOfWeek,
            hour_utc: Number(hour) || 0,
            minute_utc: Number(minute) || 0,
            active,
        };
        await onSubmit(updatePayload);
    };

    const recipientHelper =
        "Separate multiple emails with commas. All times are UTC.";

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4"
        >
            {mode === "create" ? (
                <div className="flex flex-col gap-2">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                        <UserSearch className="size-4 text-primary" />
                        Choose user
                    </Label>
                    <Input
                        placeholder="Search by name or username..."
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                    />
                    {selectedUserLabel && (
                        <p className="text-sm text-primary">
                            Selected: {selectedUserLabel}
                        </p>
                    )}
                    {searchingUsers && (
                        <p className="text-xs text-muted-foreground">
                            Searching...
                        </p>
                    )}
                    {userResults.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-xl border bg-background/80 p-3">
                            {userResults.map((user) => (
                                <button
                                    type="button"
                                    key={user.id}
                                    className="flex items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-muted"
                                    onClick={() => {
                                        setUserId(user.id);
                                        setSelectedUserLabel(
                                            `${user.name} (@${user.username})`,
                                        );
                                        setUserResults([]);
                                    }}
                                >
                                    <span className="text-sm">
                                        {user.name}{" "}
                                        <span className="text-muted-foreground">
                                            (@{user.username})
                                        </span>
                                    </span>
                                    <Check
                                        className={cn(
                                            "size-4 text-primary",
                                            userId === user.id
                                                ? "opacity-100"
                                                : "opacity-0",
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-sm text-muted-foreground">
                    Scheduling for{" "}
                    <span className="font-semibold text-foreground">
                        {selectedUserLabel || `User #${userId}`}
                    </span>
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label>To</Label>
                    <Input
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="recipient@example.com"
                    />
                    <small className="text-xs text-muted-foreground">
                        {recipientHelper}
                    </small>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>CC</Label>
                    <Input
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        placeholder="Optional"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>BCC</Label>
                    <Input
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        placeholder="Optional"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Subject</Label>
                    <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Optional subject override"
                    />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                    <Label>Day of week (UTC)</Label>
                    <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                    >
                        {DAY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Hour (UTC)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={23}
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Minute (UTC)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={59}
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setActive((prev) => !prev)}
                    className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition",
                        active
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-muted-foreground/30 text-muted-foreground",
                    )}
                >
                    <Check
                        className={cn(
                            "size-4",
                            active ? "opacity-100" : "opacity-40",
                        )}
                    />
                    {active ? "Active" : "Paused"}
                </button>
                <span className="text-xs text-muted-foreground">
                    Reports send once per week at the specified UTC time.
                </span>
            </div>

            {formError && (
                <p className="text-sm font-medium text-destructive">
                    {formError}
                </p>
            )}

            <div className="flex justify-end gap-2">
                <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Send className="size-4" />
                    )}
                    {mode === "create" ? "Create schedule" : "Save changes"}
                </Button>
            </div>
        </form>
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
        <Card className="border border-dashed bg-background/50">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-lg font-semibold">{title}</p>
                <p className="max-w-xl text-sm text-muted-foreground">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

function formatScheduleTime(schedule: ScheduledReportResponse) {
    const day =
        DAY_OPTIONS.find((d) => d.value === schedule.day_of_week)?.label ||
        schedule.day_of_week ||
        "Unknown day";
    const hour = String(schedule.hour_utc ?? 0).padStart(2, "0");
    const minute = String(schedule.minute_utc ?? 0).padStart(2, "0");
    return `${day} at ${hour}:${minute} UTC`;
}

function formatDateTime(value?: string | null) {
    if (!value) return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "n/a";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function splitEmails(raw: string) {
    return raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}
