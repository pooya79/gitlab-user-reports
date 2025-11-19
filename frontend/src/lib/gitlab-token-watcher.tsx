// components/gitlab-token-watcher.tsx
"use client";
import { create } from "zustand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------- Zustand Store ----------
interface GitlabTokenState {
    gitlabTokenFailed: boolean;
    setGitlabTokenFailed: (value: boolean) => void;
}

export const useGitlabTokenStore = create<GitlabTokenState>((set) => ({
    gitlabTokenFailed: false,
    setGitlabTokenFailed: (value) => set({ gitlabTokenFailed: value }),
}));

// ---------- Watcher Component ----------
export function GitlabTokenWatcher() {
    const router = useRouter();
    const { gitlabTokenFailed, setGitlabTokenFailed } = useGitlabTokenStore();

    useEffect(() => {
        if (gitlabTokenFailed) {
            setGitlabTokenFailed(false); // reset to prevent repeat
            router.push("/gitlab-config");
        }
    }, [gitlabTokenFailed, setGitlabTokenFailed, router]);

    return null;
}
