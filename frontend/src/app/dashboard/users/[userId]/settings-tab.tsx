"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Plus, Trash } from "lucide-react";

import {
    getUserSettingsApiPerformanceUsersUserIdSettingsGet,
    setUserSettingsApiPerformanceUsersUserIdSettingsPost,
    type GetUserSettingsApiPerformanceUsersUserIdSettingsGetResponse,
} from "@/client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearAccessToken } from "@/lib/auth";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";

type UserSettingsTabProps = {
    userId: string;
    username?: string;
};

export default function UserSettingsTab({
    userId,
    username,
}: UserSettingsTabProps) {
    const numericUserId = useMemo(() => Number.parseInt(userId, 10), [userId]);
    const [settings, setSettings] =
        useState<GetUserSettingsApiPerformanceUsersUserIdSettingsGetResponse | null>(
            null,
        );
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newEmail, setNewEmail] = useState("");
    const { setGitlabTokenFailed } = useGitlabTokenStore();

    const additionalEmails = settings?.additional_user_emails ?? [];

    useEffect(() => {
        if (!Number.isFinite(numericUserId)) {
            setError("Invalid user id provided.");
            setSettings(null);
            return;
        }

        const controller = new AbortController();

        const fetchSettings = async () => {
            setLoading(true);
            setError(null);

            try {
                const res =
                    await getUserSettingsApiPerformanceUsersUserIdSettingsGet({
                        signal: controller.signal,
                        path: { user_id: numericUserId },
                    });

                if (controller.signal.aborted) {
                    return;
                }

                if (res.error) {
                    const status = res.response?.status;
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

                    // If no settings exist yet, treat as empty without surfacing an error.
                    if (status === 404) {
                        setSettings({
                            additional_user_emails: [],
                            user_id: numericUserId,
                        });
                        setError(null);
                        return;
                    }

                    setError(
                        detail ||
                            "We could not load settings. Please try again.",
                    );
                    setSettings(null);
                    return;
                }

                setSettings(res.data ?? null);
                setError(null);
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unexpected error while loading settings.",
                    );
                    setSettings(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchSettings();

        return () => controller.abort();
    }, [numericUserId, setGitlabTokenFailed]);

    const handleSave = async (emails: string[]) => {
        if (!Number.isFinite(numericUserId)) {
            setError("Invalid user id provided.");
            return;
        }
        setSaving(true);
        setError(null);

        try {
            const res =
                await setUserSettingsApiPerformanceUsersUserIdSettingsPost({
                    path: { user_id: numericUserId },
                    body: {
                        additional_user_emails: emails,
                    },
                });

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
                    detail || "We could not update settings. Please try again.",
                );
                return;
            }

            setSettings(res.data ?? null);
            setNewEmail("");
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unexpected error while saving settings.",
            );
        } finally {
            setSaving(false);
        }
    };

    const handleAddEmail = () => {
        const normalized = newEmail.trim().toLowerCase();
        if (!normalized) {
            return;
        }
        if (additionalEmails.includes(normalized)) {
            setNewEmail("");
            return;
        }
        handleSave([...additionalEmails, normalized]);
    };

    const handleRemoveEmail = (email: string) => {
        handleSave(additionalEmails.filter((item) => item !== email));
    };

    const disableAdd =
        !newEmail.trim() ||
        saving ||
        loading ||
        !Number.isFinite(numericUserId);

    return (
        <div className="space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                    Configure additional emails to track alongside the primary
                    GitLab email for{" "}
                    <span className="font-semibold text-foreground">
                        {username ? `@${username}` : `user #${userId}`}
                    </span>
                    .
                </p>
                <p>
                    These addresses are matched when aggregating activity. The
                    main GitLab email is always included.
                </p>
            </div>

            {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            <Card className="border shadow-sm">
                <CardHeader>
                    <CardTitle>Email settings</CardTitle>
                    <CardDescription>
                        Add or remove extra emails used to attribute activity to
                        this user.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="email-input" className="text-sm">
                            Additional emails
                        </Label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex-1">
                                <Input
                                    id="email-input"
                                    placeholder="name@company.com"
                                    value={newEmail}
                                    onChange={(event) =>
                                        setNewEmail(event.target.value)
                                    }
                                    disabled={loading || saving}
                                />
                            </div>
                            <Button
                                type="button"
                                onClick={handleAddEmail}
                                disabled={disableAdd}
                                className="w-full sm:w-auto"
                            >
                                {saving ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Plus className="mr-2 size-4" />
                                )}
                                Add email
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Use corporate or alternate addresses that this user
                            commits from. Add one per line.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Loading settings
                        </div>
                    ) : null}

                    {!loading && additionalEmails.length === 0 ? (
                        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                            No additional emails configured yet.
                        </div>
                    ) : null}

                    {!loading && additionalEmails.length > 0 ? (
                        <div className="space-y-3">
                            {additionalEmails.map((email) => (
                                <div
                                    key={email}
                                    className="flex items-center justify-between rounded-2xl border bg-card/80 px-4 py-3 text-sm shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <Mail className="size-4 text-muted-foreground" />
                                        <span className="font-medium text-foreground">
                                            {email}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleRemoveEmail(email)}
                                        disabled={saving}
                                    >
                                        <Trash className="mr-2 size-4" />
                                        Remove
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
