import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
    { label: "Open reports", value: "18", trend: "+3 since yesterday" },
    { label: "Resolved today", value: "5", trend: "Last update 5m ago" },
    { label: "Pending approvals", value: "2", trend: "Needs security review" },
];

const activities = [
    { title: "Account suspension request", meta: "Submitted by ops · 5m ago" },
    {
        title: "Data export finished",
        meta: "Triggered by automation · 27m ago",
    },
    { title: "User reinstated", meta: "Approved by admin · 1h ago" },
];

const pending = [
    { title: "Confirm new admin token", status: "Waiting on you" },
    { title: "Review high-risk report", status: "SLA due in 2h" },
];

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-muted/30">
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
                <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                            GitLab user reports
                        </p>
                        <h1 className="text-3xl font-semibold leading-tight">
                            Operations dashboard
                        </h1>
                        <p className="text-muted-foreground">
                            Monitor account reports, approvals, and integration
                            health in one place.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="outline">Refresh data</Button>
                        <Button>New report</Button>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    {stats.map((stat) => (
                        <Card key={stat.label}>
                            <CardHeader className="pb-2">
                                <CardDescription>{stat.label}</CardDescription>
                                <CardTitle className="text-4xl font-semibold">
                                    {stat.value}
                                </CardTitle>
                            </CardHeader>
                            <CardFooter className="pt-0 text-sm text-muted-foreground">
                                {stat.trend}
                            </CardFooter>
                        </Card>
                    ))}
                </section>

                <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Latest activity</CardTitle>
                            <CardDescription>
                                Events from the last 24 hours across GitLab and
                                this app.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {activities.map((item) => (
                                <div
                                    key={item.title}
                                    className="border-l-2 border-primary/40 pl-4"
                                >
                                    <p className="font-medium">{item.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.meta}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter>
                            <Button variant="link" className="px-0">
                                View full timeline
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pending actions</CardTitle>
                            <CardDescription>
                                Items that need your confirmation soon.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {pending.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-lg border px-3 py-2"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium">
                                            {item.title}
                                        </p>
                                        <Badge variant="secondary">Due</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {item.status}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full">
                                Review queue
                            </Button>
                        </CardFooter>
                    </Card>
                </section>
            </main>
        </div>
    );
}
