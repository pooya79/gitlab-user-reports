import UserPerformanceDashboard from "./user-performance-dashboard";

type PageProps = {
    params: Promise<{
        userId: string;
    }>;
};

export default async function ProjectMembersPage({ params }: PageProps) {
    const { userId } = await params;
    const userIdNumber = Number.parseInt(userId, 10);
    return <UserPerformanceDashboard userId={userIdNumber} />;
}
