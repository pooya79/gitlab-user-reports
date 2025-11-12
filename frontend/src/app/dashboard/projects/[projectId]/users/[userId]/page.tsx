import UserPerformanceClient from "./user-performance-client";

type PageProps = {
    params: Promise<{
        projectId: string;
        userId: string;
    }>;
};

export default async function ProjectMembersPage({ params }: PageProps) {
    const { projectId, userId } = await params;
    const projectIdNumber = Number.parseInt(projectId, 10);
    const userIdNumber = Number.parseInt(userId, 10);
    return <UserPerformanceClient projectId={projectIdNumber} userId={userIdNumber} />;
}
