import ProjectMembersClient from "./project-members-client";

type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectMembersPage({ params }: PageProps) {
    const { id } = await params;
    const projectId = Number.parseInt(id, 10);
    return <ProjectMembersClient projectId={projectId} />;
}
