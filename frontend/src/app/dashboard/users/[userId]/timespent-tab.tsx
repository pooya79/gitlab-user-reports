import {
    ProjectTimespentCard,
    type ProjectTimelogs,
} from "@/components/project-timespent-card";
import {
    DailyProjectTimespentChart,
    type DailyProjectTimespentDatum,
} from "@/components/charts";

type TimespentTabProps = {
    userId: string;
    username?: string;
};

const MockProjectTimeSpentData: DailyProjectTimespentDatum[] = [
    { date: new Date(), hours: 2, project: "Backend API" },
    {
        date: new Date(Date.now() - 86400000 * 1),
        hours: 1.5,
        project: "Backend API",
    },
    {
        date: new Date(Date.now() - 86400000 * 2),
        hours: 3,
        project: "Backend API",
    },
    {
        date: new Date(Date.now() - 86400000 * 3),
        hours: 0.5,
        project: "Backend API",
    },
    {
        date: new Date(Date.now() - 86400000 * 4),
        hours: 0,
        project: "Backend API",
    },
    {
        date: new Date(Date.now() - 86400000 * 5),
        hours: 1,
        project: "Backend API",
    },
    {
        date: new Date(Date.now() - 86400000 * 6),
        hours: 2.5,
        project: "Backend API",
    },

    { date: new Date(), hours: 4, project: "Frontend Dashboard" },
    {
        date: new Date(Date.now() - 86400000 * 1),
        hours: 3.5,
        project: "Frontend Dashboard",
    },
    {
        date: new Date(Date.now() - 86400000 * 2),
        hours: 2,
        project: "Frontend Dashboard",
    },
    {
        date: new Date(Date.now() - 86400000 * 3),
        hours: 1,
        project: "Frontend Dashboard",
    },
    {
        date: new Date(Date.now() - 86400000 * 4),
        hours: 0,
        project: "Frontend Dashboard",
    },
    {
        date: new Date(Date.now() - 86400000 * 5),
        hours: 2.5,
        project: "Frontend Dashboard",
    },
    {
        date: new Date(Date.now() - 86400000 * 6),
        hours: 3,
        project: "Frontend Dashboard",
    },

    { date: new Date(), hours: 1, project: "Mobile App" },
    {
        date: new Date(Date.now() - 86400000 * 1),
        hours: 0.5,
        project: "Mobile App",
    },
    {
        date: new Date(Date.now() - 86400000 * 2),
        hours: 1.5,
        project: "Mobile App",
    },
    {
        date: new Date(Date.now() - 86400000 * 3),
        hours: 0.2,
        project: "Mobile App",
    },
    {
        date: new Date(Date.now() - 86400000 * 4),
        hours: 0,
        project: "Mobile App",
    },
    {
        date: new Date(Date.now() - 86400000 * 6),
        hours: 1.2,
        project: "Mobile App",
    },
];

const MockProjectTimelogs: ProjectTimelogs[] = [
    {
        project: {
            id: 101,
            name: "Backend API",
            avatar_url: null,
            web_url: "https://gitlab.com/example/backend-api",
            full_path: "example/backend-api",
            name_with_namespace: "Example / Backend API",
        },
        timelogs: [
            {
                id: 1,
                project: {
                    id: 101,
                    name: "Backend API",
                    avatar_url: null,
                    web_url: "https://gitlab.com/example/backend-api",
                    full_path: "example/backend-api",
                    name_with_namespace: "Example / Backend API",
                },
                time_spent: 3600,
                spent_at: "2025-11-10T09:15:00Z",
                summary: "Implemented authentication middleware",
                issue: {
                    iid: "24",
                    title: "Add JWT-based authentication",
                    webUrl: "https://gitlab.com/example/backend-api/-/issues/24",
                    state: "opened",
                    reference: "#24",
                },
            },
            {
                id: 2,
                project: {
                    id: 101,
                    name: "Backend API",
                    avatar_url: null,
                    web_url: "https://gitlab.com/example/backend-api",
                    full_path: "example/backend-api",
                    name_with_namespace: "Example / Backend API",
                },
                time_spent: 5400,
                spent_at: "2025-11-10T11:00:00Z",
                summary: "Review merge request for caching layer",
                merge_request: {
                    iid: "13",
                    title: "Add Redis caching layer",
                    webUrl: "https://gitlab.com/example/backend-api/-/merge_requests/13",
                    state: "merged",
                    reference: "!13",
                },
            },
        ],
        total_time_spent_hours: (3600 + 5400) / 3600,
    },

    {
        project: {
            id: 202,
            name: "Frontend Dashboard",
            avatar_url: "https://gitlab.com/uploads/frontend.png",
            web_url: "https://gitlab.com/example/frontend-dashboard",
            full_path: "example/frontend-dashboard",
            name_with_namespace: "Example / Frontend Dashboard",
        },
        timelogs: [
            {
                id: 3,
                project: {
                    id: 202,
                    name: "Frontend Dashboard",
                    avatar_url: "https://gitlab.com/uploads/frontend.png",
                    web_url: "https://gitlab.com/example/frontend-dashboard",
                    full_path: "example/frontend-dashboard",
                    name_with_namespace: "Example / Frontend Dashboard",
                },
                time_spent: 7200,
                spent_at: "2025-11-11T08:00:00Z",
                summary: "Refactored KPI cards and improved layout",
                merge_request: {
                    iid: "42",
                    title: "Redesign dashboard KPI components",
                    webUrl: "https://gitlab.com/example/frontend-dashboard/-/merge_requests/42",
                    state: "opened",
                    reference: "!42",
                },
            },
            {
                id: 4,
                project: {
                    id: 202,
                    name: "Frontend Dashboard",
                    avatar_url: "https://gitlab.com/uploads/frontend.png",
                    web_url: "https://gitlab.com/example/frontend-dashboard",
                    full_path: "example/frontend-dashboard",
                    name_with_namespace: "Example / Frontend Dashboard",
                },
                time_spent: 1800,
                spent_at: "2025-11-11T10:30:00Z",
                summary: "Fix chart spacing and alignment",
                issue: {
                    iid: "17",
                    title: "Bar chart has extra left padding",
                    webUrl: "https://gitlab.com/example/frontend-dashboard/-/issues/17",
                    state: "closed",
                    reference: "#17",
                },
            },
        ],
        total_time_spent_hours: (7200 + 1800) / 3600,
    },

    {
        project: {
            id: 303,
            name: "Mobile App",
            avatar_url: null,
            web_url: "https://gitlab.com/example/mobile-app",
            full_path: "example/mobile-app",
            name_with_namespace: "Example / Mobile App",
        },
        timelogs: [],
        total_time_spent_hours: 0,
    },
];

export default function TimespentTab({ userId, username }: TimespentTabProps) {
    return (
        <div className="space-y-3 text-sm text-muted-foreground">
            <p>
                Time spent data for{" "}
                <span className="font-semibold text-foreground">
                    {username ? `@${username}` : `user #${userId}`}
                </span>{" "}
                will live here soon.
            </p>
            <DailyProjectTimespentChart data={MockProjectTimeSpentData} />
            <ProjectTimespentCard projects={MockProjectTimelogs} />
        </div>
    );
}
