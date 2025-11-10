"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    updateGitlabConfigurationAuthGitlabPost,
    checkGitlabTokenAuthGitlabTokenCheckPost,
} from "@/client";
import { z, ZodError } from "zod";

const zGitlabConfigData = z.object({
    gitlab_url: z.url("Please enter a valid URL."),
    gitlab_admin_token: z.string().min(1, "Admin token cannot be empty."),
});

export default function GitlabConfigPage() {
    const router = useRouter();
    const [gitlabUrl, setGitlabUrl] = useState("");
    const [adminToken, setAdminToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [valid, setValid] = useState<boolean | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            zGitlabConfigData.parse({
                gitlab_url: gitlabUrl,
                gitlab_admin_token: adminToken,
            });

            const res = await updateGitlabConfigurationAuthGitlabPost({
                body: {
                    gitlab_url: gitlabUrl,
                    gitlab_admin_token: adminToken,
                },
            });

            const valid = await handleCheckSubmit();
            if (!valid) {
                return;
            }

            // Handle API-level errors
            if (res.error) {
                if (typeof res.error.detail === "string") {
                    setError(res.error.detail);
                } else {
                    console.error("Login failed:", res.error);
                    setError("Login failed. Please check your credentials.");
                }
                return;
            }

            // On success, redirect to dashboard
            router.push("/dashboard");
        } catch (err) {
            // Handle client-side or validation errors
            if (err instanceof ZodError) {
                // Combine Zod field messages
                const fieldErrors = err.issues
                    .map((i) => `${i.message}`)
                    .join("\n");
                setError(fieldErrors);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                console.error("Failed to update GitLab configuration:", err);
                setError("Failed to save settings. Please check your inputs.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCheckSubmit = async () => {
        setError(null);
        setLoading(true);

        try {
            zGitlabConfigData.parse({
                gitlab_url: gitlabUrl,
                gitlab_admin_token: adminToken,
            });

            const res = await checkGitlabTokenAuthGitlabTokenCheckPost({
                body: {
                    gitlab_url: gitlabUrl,
                    gitlab_admin_token: adminToken,
                },
            });

            // Handle API-level errors
            if (res.error) {
                if (typeof res.error.detail === "string") {
                    setError(res.error.detail);
                } else {
                    console.error("Token check failed:", res.error);
                    setError(
                        "Token check failed. Please check your credentials.",
                    );
                }
                return;
            }

            const data = res.data;
            if (data?.valid) {
                setValid(true);
                setError(null);
            } else {
                setValid(false);
                setError("Token is invalid. Please verify and try again.");
            }
            return data?.valid;
        } catch (err) {
            // Handle client-side or validation errors
            if (err instanceof ZodError) {
                // Combine Zod field messages
                const fieldErrors = err.issues
                    .map((i) => `${i.message}`)
                    .join("\n");
                setError(fieldErrors);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                console.error("Failed to check GitLab token:", err);
                setError("Failed to check token. Please check your inputs.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-16">
            <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1.6fr_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            GitLab settings
                        </CardTitle>
                        <CardDescription>
                            You were redirected here because the GitLab admin
                            token is missing or invalid. Update the details
                            below to resume using the app.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {valid === true && !error && (
                            <div className="mb-6 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                                <p className="font-medium">
                                    Token is valid and working!
                                </p>
                            </div>
                        )}
                        {error && (
                            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                <p className="font-medium">
                                    Token validation failed
                                </p>
                                <p>{error}</p>
                            </div>
                        )}
                        <form
                            className="flex flex-col gap-6"
                            onSubmit={handleSubmit}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="gitlab-url">GitLab URL</Label>
                                <Input
                                    id="gitlab-url"
                                    name="gitlab-url-input"
                                    type="url"
                                    placeholder="https://gitlab.example.com"
                                    autoComplete="off"
                                    value={gitlabUrl}
                                    onChange={(e) =>
                                        setGitlabUrl(e.target.value)
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin-token">
                                    Admin access token
                                </Label>
                                <Input
                                    id="admin-token"
                                    name="admin-token-input"
                                    type="password"
                                    placeholder="glpat-****************"
                                    autoComplete="new-password"
                                    value={adminToken}
                                    onChange={(e) =>
                                        setAdminToken(e.target.value)
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
                                    onClick={handleCheckSubmit}
                                >
                                    Test connection
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 sm:flex-none"
                                >
                                    Save settings
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
                        <p>
                            Tokens should have minimal privileges and can be
                            revoked anytime from your GitLab account.
                        </p>
                        <p>
                            Configuration stays on the server and is never
                            shared publicly.
                        </p>
                    </CardFooter>
                </Card>
                <Card className="bg-card/60">
                    <CardHeader>
                        <CardTitle>Need help?</CardTitle>
                        <CardDescription>
                            Quick checklist before connecting to GitLab. This
                            page only shows up during setup or whenever access
                            breaks.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <div className="space-y-1">
                            <p className="font-medium text-foreground">
                                URL format
                            </p>
                            <p>
                                Use the root URL of your GitLab instance,
                                including https.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-foreground">
                                Token scope
                            </p>
                            <p>
                                Personal access tokens should include the{" "}
                                <span className="font-medium text-foreground">
                                    api
                                </span>{" "}
                                scope.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-foreground">
                                Expiration
                            </p>
                            <p>
                                Rotating tokens regularly keeps your integration
                                secure. Update the settings any time.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
