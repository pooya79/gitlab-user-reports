"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        // Redirect based on authentication status
        if (isAuthenticated()) {
            router.push("/dashboard");
        } else {
            router.push("/login");
        }
    }, [router]);

    // Show loading state while redirecting
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="text-lg">Loading...</p>
            </div>
        </div>
    );
}
