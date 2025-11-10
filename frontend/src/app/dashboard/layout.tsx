"use client";

import { ProtectedRoute } from "@/lib/protected-route";
import { GitlabTokenWatcher } from "@/lib/gitlab-token-watcher";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <GitlabTokenWatcher />
            {children}
        </ProtectedRoute>
    );
}
