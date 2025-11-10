// components/gitlab-token-watcher.tsx
"use client";
import { create } from "zustand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------- Zustand Store ----------
interface GitlabTokenState {
    failed: boolean;
    setFailed: (value: boolean) => void;
}

export const useGitlabTokenStore = create<GitlabTokenState>((set) => ({
    failed: false,
    setFailed: (value) => set({ failed: value }),
}));

// ---------- Watcher Component ----------
export function GitlabTokenWatcher() {
    const router = useRouter();
    const { failed, setFailed } = useGitlabTokenStore();

    useEffect(() => {
        if (failed) {
            setFailed(false); // reset to prevent repeat
            router.push("/gitlab-config");
        }
    }, [failed, setFailed, router]);

    return null;
}
