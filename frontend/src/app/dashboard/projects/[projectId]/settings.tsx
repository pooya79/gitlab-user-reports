"use client";

type SettingsTabProps = {
    projectId: number;
};

export default function SettingsTab({ projectId }: SettingsTabProps) {
    return (
        <TabPlaceholder
            title="Project settings"
            description={`Configuration for project #${projectId} will be managed from this tab.`}
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
