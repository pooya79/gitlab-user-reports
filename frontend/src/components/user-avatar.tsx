"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, LogOut, Mail, Wrench } from "lucide-react";
import { clearAccessToken } from "@/lib/auth";
import { type GitlabUserInfo, getProfileAuthMeGet } from "@/client";
import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";

export function UserAvatar() {
    const router = useRouter();
    const [userInfo, setUserInfo] = useState<GitlabUserInfo | null>(null);
    const { setFailed } = useGitlabTokenStore();

    const fetchUserInfo = async () => {
        try {
            const res = await getProfileAuthMeGet();

            if (res.error) {
                const detail =
                    typeof res.error?.detail === "string"
                        ? res.error.detail
                        : (res.error as { detail?: string })?.detail;
                if (detail === "gitlab_token_required") {
                    setFailed(true);
                    return;
                }
                if (detail === "login_required") {
                    clearAccessToken();
                }
            }

            if (res.data) {
                setUserInfo(res.data.gitlab_user_info ?? null);
            }
        } catch (error) {
            console.error("Failed to fetch user info:", error);
        }
    };

    useEffect(() => {
        fetchUserInfo();
    }, []);

    const logout = () => {
        clearAccessToken();
        router.push("/login");
    };

    return (
        <>
            {userInfo ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-10 w-10 rounded-full"
                        >
                            <Avatar className="h-10 w-10">
                                <AvatarImage
                                    src={userInfo.avatar_url || undefined}
                                    alt={userInfo.name || userInfo.username}
                                />
                                <AvatarFallback>
                                    {userInfo.name?.charAt(0).toUpperCase() ||
                                        userInfo.username
                                            .charAt(0)
                                            .toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-64"
                        align="end"
                        forceMount
                    >
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage
                                            src={
                                                userInfo.avatar_url || undefined
                                            }
                                            alt={
                                                userInfo.name ||
                                                userInfo.username
                                            }
                                        />
                                        <AvatarFallback>
                                            {userInfo.name
                                                ?.charAt(0)
                                                .toUpperCase() ||
                                                userInfo.username
                                                    .charAt(0)
                                                    .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-none truncate">
                                            {userInfo.name || userInfo.username}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                            @{userInfo.username}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">
                                        {userInfo.email}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a
                                href={userInfo.web_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer flex items-center"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                <span>View GitLab Profile</span>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a
                                href="/gitlab-config"
                                className="cursor-pointer flex items-center"
                            >
                                <Wrench className="mr-2 h-4 w-4" />
                                <span>New GitLab Config</span>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={logout}
                            className="cursor-pointer text-red-600"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button onClick={logout} variant="outline" size="sm">
                    Logout
                </Button>
            )}{" "}
        </>
    );
}
