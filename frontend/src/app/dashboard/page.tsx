"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChartColumnBig, GitBranch, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import ProjectsTab from "./projects-tab";
import UsersTab from "./users-tab";

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<"projects" | "users">("users");

    return (
        <div className="min-h-screen bg-muted/30">
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
                <header className="flex flex-col gap-4 rounded-3xl border bg-background/80 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <ChartColumnBig className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                                GitLab reports
                            </p>
                            <p className="text-lg font-semibold leading-tight">
                                Operations workspace
                            </p>
                        </div>
                    </div>
                    <nav className="flex flex-wrap items-center gap-2">
                        <TabButton
                            label="Users"
                            icon={<Users className="size-4" />}
                            isActive={activeTab === "users"}
                            onClick={() => setActiveTab("users")}
                        />
                        <TabButton
                            label="Projects"
                            icon={<GitBranch className="size-4" />}
                            isActive={activeTab === "projects"}
                            onClick={() => setActiveTab("projects")}
                        />
                    </nav>
                    <div className="flex justify-end">
                        <UserAvatar />
                    </div>
                </header>

                <UsersTab isActive={activeTab === "users"} />
                <ProjectsTab isActive={activeTab === "projects"} />
            </main>
        </div>
    );
}

function TabButton({
    icon,
    label,
    isActive,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant={isActive ? "secondary" : "ghost"}
            className={cn(
                "rounded-full px-4 py-2 text-sm",
                isActive && "shadow-sm",
            )}
            onClick={onClick}
        >
            {icon}
            {label}
        </Button>
    );
}
