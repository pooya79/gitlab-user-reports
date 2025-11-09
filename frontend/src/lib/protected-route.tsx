"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { isAuthenticated, clearAccessToken } from "@/lib/auth";

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await isAuthenticated();
            if (!authenticated) {
                router.replace(
                    `/login?redirect=${encodeURIComponent(pathname)}`,
                );
            } else {
                setIsAuthorized(true);
            }
            setIsChecking(false);
        };

        checkAuth();

        const handleStorate = (event: StorageEvent) => {
            if (event.key === "accessToken" && event.newValue === null) {
                // Token removed, log out the user
                router.replace(
                    `/login?redirect=${encodeURIComponent(pathname)}`,
                );
            }
        };

        window.addEventListener("storage", handleStorate);

        return () => {
            window.removeEventListener("storage", handleStorate);
        };
    }, [router, pathname]);

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
