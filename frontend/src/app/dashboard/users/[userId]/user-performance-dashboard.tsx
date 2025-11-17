"use client";

type UserPerformanceDashboardProps = {
    userId: number;
};

export default function UserPerformanceDashboard({
    userId,
}: UserPerformanceDashboardProps) {
    return <div>User Performance Dashboard for User ID: {userId}</div>;
}
