import ProjectDashboard from "./project-dashboard";

type PageProps = {
    params: Promise<{
        projectId: string;
    }>;
};

export default async function ProjectMembersPage({ params }: PageProps) {
    const { projectId } = await params;
    const projectIdNumber = Number.parseInt(projectId, 10);
    return <ProjectDashboard projectId={projectIdNumber} />;
}
