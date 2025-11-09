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
    title: "Login",
    description: "Sign in to manage GitLab user reports.",
};

export default function LoginPage() {
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
                    <form className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                name="username"
                                placeholder="gitlab-user"
                                autoComplete="username"
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
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Continue
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
