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
import { loginApiAuthLoginPost } from "@/client";
import { z, ZodError } from "zod";

const zLoginAuthLoginPostData = z.object({
    username: z
        .string()
        .min(3, "Username is too short (more than 3 characters)."),
    password: z
        .string()
        .min(6, "Password is too small (more than 6 characters)."),
});

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const username = formData.get("username") as string;
        const password = formData.get("password") as string;

        try {
            // Validate before sending
            zLoginAuthLoginPostData.parse({ username, password });

            // Send request
            const res = await loginApiAuthLoginPost({
                body: { username, password },
            });

            console.log(res);

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

            const data = res.data;
            localStorage.setItem("accessToken", data?.access_token ?? "");

            // Redirect to gitlab config page if it is first time login
            if (!data?.gitlab_configured) {
                router.push("/gitlab-config");
            } else {
                router.push("/dashboard");
            }
        } catch (err) {
            // Handle client-side or validation errors
            if (err instanceof ZodError) {
                // Combine Zod field messages
                const fieldErrors = err.issues
                    .map((i) => `${i.path.join(".")}: ${i.message}`)
                    .join("\n");
                setError(fieldErrors);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Login failed. Please try again.");
            }
            console.error("Login failed:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-16">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Sign in</CardTitle>
                    <CardDescription>
                        Create your admin credentials on the first visit, then
                        sign in with the same username and password afterward.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        className="flex flex-col gap-6"
                        onSubmit={handleSubmit}
                    >
                        {error && (
                            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                placeholder="admin"
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                disabled={loading}
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Continue"}
                        </Button>
                    </form>
                    <div className="mt-6 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">
                            First-time setup
                        </p>
                        <p>
                            If no user exists yet, submitting this form
                            provisions the only account for the app. Future
                            visits require the credentials you set here.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
                    <p>Your credentials are never stored in the browser.</p>
                    <p>
                        Contact your admin if you lose access to the workspace.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
