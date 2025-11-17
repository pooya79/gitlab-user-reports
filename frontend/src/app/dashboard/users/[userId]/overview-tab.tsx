import { Loader2 } from "lucide-react";
import {
    DailyCommitChart,
    DailyLineChangesChart,
    type DailyCommitDatum,
    type DailyLineChangesDatum,
} from "@/components/charts";
import { KPICardGroup, type KPIEntry } from "@/components/kpi-card-group";
import {
    ProjectContributionsCard,
    type ProjectContribution,
} from "@/components/project-contributions-card";

const MockDailyCommitData: DailyCommitDatum[] = [
    { date: new Date(), commits: 5 },
    { date: new Date(Date.now() - 86400000 * 1), commits: 3 },
    { date: new Date(Date.now() - 86400000 * 2), commits: 8 },
    { date: new Date(Date.now() - 86400000 * 3), commits: 2 },
    { date: new Date(Date.now() - 86400000 * 4), commits: 0 },
    { date: new Date(Date.now() - 86400000 * 5), commits: 4 },
    { date: new Date(Date.now() - 86400000 * 6), commits: 6 },
];

const MockDailyLineChangesData: DailyLineChangesDatum[] = [
    {
        date: new Date(),
        linesAdded: 150,
        linesDeleted: 50,
    },
    {
        date: new Date(Date.now() - 86400000 * 1),
        linesAdded: 100,
        linesDeleted: 80,
    },
    {
        date: new Date(Date.now() - 86400000 * 2),
        linesAdded: 200,
        linesDeleted: 20,
    },
    {
        date: new Date(Date.now() - 86400000 * 3),
        linesAdded: 50,
        linesDeleted: 100,
    },
    {
        date: new Date(Date.now() - 86400000 * 4),
        linesAdded: 0,
        linesDeleted: 0,
    },
    {
        date: new Date(Date.now() - 86400000 * 5),
        linesAdded: 120,
        linesDeleted: 60,
    },
    {
        date: new Date(Date.now() - 86400000 * 6),
        linesAdded: 180,
        linesDeleted: 40,
    },
];

const MockKPIData: Record<string, KPIEntry> = {
    totalCommits: {
        name: "Total Commits",
        description: "Total number of commits made by the user.",
        value: 28,
    },
    totalLinesChanges: {
        name: "Total Line Changes",
        description: "Total lines added and deleted by the user.",
        value: (
            <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-medium">
                    +{50 + 120 + 180}
                </span>
                <span className="text-red-600 font-medium">
                    -{50 + 80 + 20}
                </span>
                <span className="text-muted-foreground">
                    ({50 + 120 + 180 + 50 + 80 + 20})
                </span>
            </div>
        ),
    },
    averageCommitsPerDay: {
        name: "Avg. Commits/Day",
        description: "Average number of commits made per day.",
        value: (28 / 7).toFixed(2),
    },
    projectsContributedTo: {
        name: "Projects Contributed To",
        description:
            "Number of different projects the user has contributed to.",
        value: 5,
    },
    activeDays: {
        name: "Active Days",
        description: "Number of days the user was active.",
        value: 6,
    },
};

const MockProjectContributions: ProjectContribution[] = [
    {
        project_id: 101,
        project_name: "Analytics Service",
        project_path_name: "data/analytics-service",
        avatar_url: null,
        web_url: "https://gitlab.com/example/analytics-service",
        total_commits: 18,
        total_additions: 1250,
        total_deletions: 640,
        total_changes: 1890,
        total_mr_contributed: 3,
        merge_requests: [
            {
                iid: 37,
                title: "Improve ingestion throughput",
                description:
                    "Refines batching strategy and adds observability for ingestion alerts.",
                web_url:
                    "https://gitlab.com/example/analytics-service/merge_requests/37",
                state: "merged",
                created_at: "2024-07-18T10:24:00.000Z",
                total_commits: 4,
                total_additions: 640,
                total_deletions: 210,
            },
            {
                iid: 41,
                title: "Add anomaly detection to dashboards",
                description:
                    "Introduces initial anomaly scoring and toggles via feature flag.",
                web_url:
                    "https://gitlab.com/example/analytics-service/merge_requests/41",
                state: "opened",
                created_at: "2024-07-20T14:05:00.000Z",
                total_commits: 6,
                total_additions: 380,
                total_deletions: 90,
            },
        ],
    },
    {
        project_id: 202,
        project_name: "API Gateway",
        project_path_name: "infra/api-gateway",
        avatar_url: "https://placehold.co/64x64",
        web_url: "https://gitlab.com/example/api-gateway",
        total_commits: 9,
        total_additions: 520,
        total_deletions: 180,
        total_changes: 700,
        total_mr_contributed: 2,
        merge_requests: [
            {
                iid: 12,
                title: "Harden request signing",
                description:
                    "Updates signing library, rotates secrets, and adds tests.",
                web_url:
                    "https://gitlab.com/example/api-gateway/merge_requests/12",
                state: "merged",
                created_at: "2024-07-10T08:45:00.000Z",
                total_commits: 3,
                total_additions: 210,
                total_deletions: 60,
            },
            {
                iid: 15,
                title: "Add circuit breaking metrics",
                description:
                    "Exports Prometheus metrics and hooks alerts for failures.",
                web_url:
                    "https://gitlab.com/example/api-gateway/merge_requests/15",
                state: "closed",
                created_at: "2024-07-14T16:12:00.000Z",
                total_commits: 2,
                total_additions: 110,
                total_deletions: 40,
            },
        ],
    },
];

export default function OverviewTab({
    loading,
    userId,
    username,
}: {
    loading: boolean;
    userId: number;
    username?: string;
}) {
    return (
        <div className="space-y-3 text-sm text-muted-foreground">
            <p>
                Overview insights for{" "}
                <span className="font-semibold text-foreground">
                    {username ? `@${username}` : `user #${userId}`}
                </span>{" "}
                will live here soon.
            </p>
            <p>
                Use this space to highlight contributions, summaries, or any
                high-level signals for the selected time period.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
                <DailyCommitChart data={MockDailyCommitData} />
                <DailyLineChangesChart data={MockDailyLineChangesData} />
            </div>
            <KPICardGroup kpis={MockKPIData} />
            <ProjectContributionsCard
                projects={MockProjectContributions}
                userId={userId}
            />
            {loading ? (
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wide">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading user data
                </p>
            ) : null}
        </div>
    );
}
