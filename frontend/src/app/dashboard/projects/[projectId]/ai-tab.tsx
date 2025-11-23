"use client";

type AiTabProps = {
    projectId: number;
};

export default function AiTab({ projectId }: AiTabProps) {
    return (
        <TabPlaceholder
            title="AI workspace"
            description={`AI summaries and recommendations for project #${projectId} will appear here.`}
        />
    );
}

function TabPlaceholder({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex min-h-[220px] flex-col justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-6 py-10">
            <p className="text-lg font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
