import { Metadata } from "next";

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

export const metadata: Metadata = {
    title: "GitLab Configuration",
    description: "Provide the GitLab connection details for the application.",
};

export default function GitlabConfigPage() {
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
                        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            <p className="font-medium">
                                Token validation failed
                            </p>
                            <p>
                                Please verify the target instance and provide a
                                valid admin token.
                            </p>
                        </div>
                        <form className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="gitlab-url">GitLab URL</Label>
                                <Input
                                    id="gitlab-url"
                                    name="gitlab-url"
                                    type="url"
                                    placeholder="https://gitlab.example.com"
                                    autoComplete="url"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admin-token">
                                    Admin access token
                                </Label>
                                <Input
                                    id="admin-token"
                                    name="admin-token"
                                    type="password"
                                    placeholder="glpat-****************"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
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
