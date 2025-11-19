// "use client";

// import Link from "next/link";
// import { useCallback, useEffect, useMemo, useState } from "react";
// import {
//     addWeeks,
//     eachDayOfInterval,
//     endOfWeek,
//     format,
//     formatDistanceToNow,
//     startOfWeek,
//     subWeeks,
// } from "date-fns";
// import type { DateRange } from "react-day-picker";
// import {
//     ArrowLeft,
//     ArrowUpRight,
//     ChevronLeft,
//     ChevronRight,
//     ExternalLink,
//     FileDiff,
//     GitCommit,
//     GitPullRequest,
//     Loader2,
//     RefreshCcw,
// } from "lucide-react";

// import {
//     getUserPerformanceUserPerformanceProjectsProjectIdUsersUserIdPerformanceGet,
//     refreshUserPerformanceUserPerformanceProjectsProjectIdUsersUserIdPerformanceRefreshPost,
//     type UserPerformanceResponse,
// } from "@/client";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//     Card,
//     CardContent,
//     CardDescription,
//     CardFooter,
//     CardHeader,
//     CardTitle,
// } from "@/components/ui/card";
// import {
//     ChartContainer,
//     ChartTooltip,
//     ChartTooltipContent,
//     type ChartConfig,
// } from "@/components/ui/chart";
// import { WeekPicker } from "@/components/week-picker";
// import { useGitlabTokenStore } from "@/lib/gitlab-token-watcher";
// import { clearAccessToken } from "@/lib/auth";
// import type { LucideIcon } from "lucide-react";
// import {
//     Bar,
//     BarChart,
//     CartesianGrid,
//     Line,
//     LineChart,
//     XAxis,
//     YAxis,
// } from "recharts";

// type UserPerformanceClientProps = {
//     projectId: number;
//     userId: number;
// };

// type SummaryStat = {
//     key: string;
//     label: string;
//     value: number;
//     description: string;
//     icon: LucideIcon;
// };

// type DailyPoint = {
//     dateKey: string;
//     label: string;
//     commits: number;
//     additions: number;
//     deletions: number;
//     changes: number;
// };

// const WEEK_START_DAY: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;
// const numberFormatter = new Intl.NumberFormat();

// const commitsChartConfig: ChartConfig = {
//     commits: {
//         label: "Commits",
//         color: "hsl(var(--primary))",
//     },
// };

// const changesChartConfig: ChartConfig = {
//     additions: {
//         label: "Additions",
//         color: "hsl(var(--chart-1, var(--primary)))",
//     },
//     deletions: {
//         label: "Deletions",
//         color: "hsl(var(--destructive))",
//     },
//     changes: {
//         label: "Changes",
//         color: "hsl(var(--muted-foreground))",
//     },
// };

// export default function UserPerformanceClient({
//     projectId,
//     userId,
// }: UserPerformanceClientProps) {
//     const [selectedWeek, setSelectedWeek] = useState<DateRange>(() =>
//         createWeekRange(new Date()),
//     );
//     const [performance, setPerformance] =
//         useState<UserPerformanceResponse | null>(null);
//     const [loading, setLoading] = useState(false);
//     const [refreshing, setRefreshing] = useState(false);
//     const [error, setError] = useState<string | null>(null);
//     const { setGitlabTokenFailed } = useGitlabTokenStore();

//     const weekParams = useMemo(() => {
//         if (!selectedWeek?.from || !selectedWeek?.to) {
//             return null;
//         }
//         return {
//             start_date: format(selectedWeek.from, "yyyy-MM-dd"),
//             end_date: format(selectedWeek.to, "yyyy-MM-dd"),
//         };
//     }, [selectedWeek]);

//     const weekLabel = useMemo(() => {
//         if (!selectedWeek?.from || !selectedWeek?.to) {
//             return "Select a week";
//         }
//         const sameYear =
//             selectedWeek.from.getFullYear() === selectedWeek.to.getFullYear();
//         const startLabel = format(selectedWeek.from, "MMM d");
//         const endLabel = format(
//             selectedWeek.to,
//             sameYear ? "MMM d, yyyy" : "MMM d, yyyy",
//         );
//         return `${startLabel} – ${endLabel}`;
//     }, [selectedWeek]);

//     const lastCalculatedLabel = useMemo(() => {
//         if (!performance?.calculated_at) {
//             return "Not calculated yet";
//         }
//         const calculatedDate = new Date(performance.calculated_at);
//         if (Number.isNaN(calculatedDate.getTime())) {
//             return "Not calculated yet";
//         }
//         return `Calculated ${formatDistanceToNow(calculatedDate, {
//             addSuffix: true,
//         })}`;
//     }, [performance?.calculated_at]);

//     const fetchPerformance = useCallback(
//         async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
//             if (!Number.isFinite(projectId) || !Number.isFinite(userId)) {
//                 setError("Invalid project or user.");
//                 setPerformance(null);
//                 return;
//             }
//             if (!weekParams) {
//                 return;
//             }

//             setError(null);
//             if (forceRefresh) {
//                 setRefreshing(true);
//             } else {
//                 setLoading(true);
//             }

//             const requestOptions = {
//                 path: {
//                     project_id: String(projectId),
//                     user_id: userId,
//                 },
//                 query: weekParams,
//             };

//             const runRequest = async (useRefresh: boolean) => {
//                 const fn = useRefresh
//                     ? refreshUserPerformanceUserPerformanceProjectsProjectIdUsersUserIdPerformanceRefreshPost
//                     : getUserPerformanceUserPerformanceProjectsProjectIdUsersUserIdPerformanceGet;
//                 const res = await fn(requestOptions);

//                 if (res.error) {
//                     const status = res.response.status;
//                     const detail =
//                         typeof res.error?.detail === "string"
//                             ? res.error.detail
//                             : (res.error as { detail?: string })?.detail;

//                     if (detail === "gitlab_token_required") {
//                         setGitlabTokenFailed(true);
//                         return null;
//                     }
//                     if (detail === "login_required") {
//                         clearAccessToken();
//                     }
//                     if (status === 404 && !useRefresh) {
//                         // Fall back to refresh endpoint
//                         return null;
//                     }
//                     throw new Error(
//                         detail ||
//                             "We could not load performance data. Please try again.",
//                     );
//                 }

//                 return res.data as UserPerformanceResponse | undefined;
//             };

//             try {
//                 let data = await runRequest(forceRefresh);
//                 if (!data && !forceRefresh) {
//                     data = await runRequest(true);
//                 }

//                 if (!data) {
//                     setPerformance(null);
//                     if (forceRefresh) {
//                         setError(
//                             "We could not refresh this week's stats. Please try again shortly.",
//                         );
//                     } else {
//                         setError(
//                             "No cached data for this week. Use refresh to calculate the latest stats.",
//                         );
//                     }
//                 } else {
//                     setPerformance(data);
//                 }
//             } catch (err) {
//                 setError(
//                     err instanceof Error
//                         ? err.message
//                         : "Unexpected error while loading performance.",
//                 );
//             } finally {
//                 if (forceRefresh) {
//                     setRefreshing(false);
//                 } else {
//                     setLoading(false);
//                 }
//             }
//         },
//         [projectId, userId, weekParams, setGitlabTokenFailed],
//     );

//     useEffect(() => {
//         fetchPerformance();
//     }, [fetchPerformance]);

//     const handleWeekChange = useCallback((range?: DateRange) => {
//         if (range?.from && range?.to) {
//             setSelectedWeek(range);
//         }
//     }, []);

//     const shiftWeek = useCallback((direction: -1 | 1) => {
//         setSelectedWeek((current) => {
//             const anchor = current?.from ?? new Date();
//             const nextStart =
//                 direction === -1 ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
//             return createWeekRange(nextStart);
//         });
//     }, []);

//     const dailyData: DailyPoint[] = useMemo(() => {
//         if (!selectedWeek?.from || !selectedWeek?.to) {
//             return [];
//         }
//         const days = eachDayOfInterval({
//             start: selectedWeek.from,
//             end: selectedWeek.to,
//         });
//         return days.map((day) => {
//             const key = format(day, "yyyy-MM-dd");
//             return {
//                 dateKey: key,
//                 label: format(day, "EEE, MMM d"),
//                 commits: performance?.daily_commit_counts?.[key] ?? 0,
//                 additions: performance?.daily_additions?.[key] ?? 0,
//                 deletions: performance?.daily_deletions?.[key] ?? 0,
//                 changes: performance?.daily_changes?.[key] ?? 0,
//             };
//         });
//     }, [performance, selectedWeek]);

//     const summaryStats: SummaryStat[] = useMemo(() => {
//         return [
//             {
//                 key: "commits",
//                 label: "Commits",
//                 value: performance?.total_commits ?? 0,
//                 description: "Total commits authored this week",
//                 icon: GitCommit,
//             },
//             {
//                 key: "changes",
//                 label: "Changes",
//                 value: performance?.total_changes ?? 0,
//                 description: "Lines changed (additions + deletions)",
//                 icon: FileDiff,
//             },
//             {
//                 key: "additions",
//                 label: "Additions",
//                 value: performance?.total_additions ?? 0,
//                 description: "Lines added to the codebase",
//                 icon: ArrowUpRight,
//             },
//             {
//                 key: "merges",
//                 label: "Merge requests",
//                 value:
//                     performance?.total_mr_contributed ??
//                     performance?.merge_requests?.length ??
//                     0,
//                 description: "Merge requests contributed",
//                 icon: GitPullRequest,
//             },
//         ];
//     }, [performance]);

//     const sinceLabel = safeFormat(performance?.since);
//     const untilLabel = safeFormat(performance?.until);
//     const timeframeLabel =
//         sinceLabel && untilLabel ? `${sinceLabel} – ${untilLabel}` : null;
//     const usernameLabel = performance?.username
//         ? `@${performance.username}`
//         : `User #${userId}`;
//     const projectLabel = performance?.project_path_name
//         ? performance.project_path_name
//         : `Project #${projectId}`;

//     if (!Number.isFinite(projectId) || !Number.isFinite(userId)) {
//         return (
//             <div className="flex min-h-screen items-center justify-center px-6">
//                 <Card className="max-w-lg">
//                     <CardHeader>
//                         <CardTitle>Invalid parameters</CardTitle>
//                         <CardDescription>
//                             Project or user information is missing.
//                         </CardDescription>
//                     </CardHeader>
//                     <CardFooter>
//                         <Button asChild>
//                             <Link href="/dashboard">Back to dashboard</Link>
//                         </Button>
//                     </CardFooter>
//                 </Card>
//             </div>
//         );
//     }

//     const isInitialLoading = loading && !performance;

//     return (
//         <div className="min-h-screen bg-muted/30 pb-12 pt-8">
//             <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
//                 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//                     <Button
//                         type="button"
//                         variant="ghost"
//                         className="w-fit gap-2"
//                         asChild
//                     >
//                         <Link href={`/dashboard/projects/${projectId}`}>
//                             <ArrowLeft className="size-4" />
//                             Back to project
//                         </Link>
//                     </Button>
//                     <div className="flex flex-wrap gap-2">
//                         <Badge className="w-fit">{projectLabel}</Badge>
//                         <Badge variant="outline" className="w-fit">
//                             {usernameLabel}
//                         </Badge>
//                     </div>
//                 </div>

//                 <Card>
//                     <CardHeader className="gap-2">
//                         <CardTitle>Weekly performance</CardTitle>
//                         <CardDescription>
//                             Pick a week to explore contributions for{" "}
//                             {usernameLabel}.
//                         </CardDescription>
//                     </CardHeader>
//                     <CardContent className="space-y-4">
//                         <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
//                             <div>
//                                 <p className="text-sm text-muted-foreground">
//                                     Selected week
//                                 </p>
//                                 <p className="text-xl font-semibold">
//                                     {weekLabel}
//                                 </p>
//                                 {timeframeLabel && (
//                                     <p className="text-sm text-muted-foreground">
//                                         Data window: {timeframeLabel}
//                                     </p>
//                                 )}
//                             </div>
//                             <div className="flex flex-wrap items-center gap-2">
//                                 <Button
//                                     type="button"
//                                     variant="outline"
//                                     size="icon"
//                                     onClick={() => shiftWeek(-1)}
//                                     aria-label="Previous week"
//                                 >
//                                     <ChevronLeft className="size-4" />
//                                 </Button>
//                                 <Button
//                                     type="button"
//                                     variant="outline"
//                                     size="icon"
//                                     onClick={() => shiftWeek(1)}
//                                     aria-label="Next week"
//                                 >
//                                     <ChevronRight className="size-4" />
//                                 </Button>
//                                 <Button
//                                     type="button"
//                                     variant="ghost"
//                                     size="sm"
//                                     className="gap-2"
//                                     onClick={() =>
//                                         fetchPerformance({ forceRefresh: true })
//                                     }
//                                     disabled={refreshing || loading}
//                                 >
//                                     {refreshing ? (
//                                         <Loader2 className="size-4 animate-spin" />
//                                     ) : (
//                                         <RefreshCcw className="size-4" />
//                                     )}
//                                     Refresh stats
//                                 </Button>
//                             </div>
//                         </div>
//                         <WeekPicker
//                             value={selectedWeek}
//                             onChange={handleWeekChange}
//                             weekStartsOn={WEEK_START_DAY}
//                             className="mt-2 rounded-2xl border"
//                         />
//                     </CardContent>
//                     <CardFooter className="text-sm text-muted-foreground">
//                         {lastCalculatedLabel}
//                     </CardFooter>
//                 </Card>

//                 {error && (
//                     <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
//                         {error}
//                     </div>
//                 )}

//                 {isInitialLoading ? (
//                     <PerformanceSkeleton />
//                 ) : performance ? (
//                     <>
//                         <section className="grid gap-4 md:grid-cols-2">
//                             {summaryStats.map((stat) => (
//                                 <StatCard key={stat.key} stat={stat} />
//                             ))}
//                         </section>

//                         <section className="grid gap-4 lg:grid-cols-2">
//                             <Card className="border bg-background/90 shadow-sm">
//                                 <CardHeader>
//                                     <CardTitle>Daily commits</CardTitle>
//                                     <CardDescription>
//                                         Commit frequency across the selected
//                                         week.
//                                     </CardDescription>
//                                 </CardHeader>
//                                 <CardContent>
//                                     <ChartContainer
//                                         config={commitsChartConfig}
//                                         className="h-64 aspect-auto"
//                                     >
//                                         <BarChart data={dailyData}>
//                                             <CartesianGrid
//                                                 vertical={false}
//                                                 strokeDasharray="3 3"
//                                             />
//                                             <XAxis
//                                                 dataKey="label"
//                                                 tickLine={false}
//                                                 axisLine={false}
//                                                 tickFormatter={(value) =>
//                                                     value.split(",")[0]
//                                                 }
//                                             />
//                                             <YAxis
//                                                 allowDecimals={false}
//                                                 tickLine={false}
//                                                 axisLine={false}
//                                             />
//                                             <ChartTooltip
//                                                 cursor={{
//                                                     fill: "var(--muted)",
//                                                 }}
//                                                 content={
//                                                     <ChartTooltipContent indicator="dot" />
//                                                 }
//                                             />
//                                             <Bar
//                                                 dataKey="commits"
//                                                 fill="var(--color-commits)"
//                                                 radius={6}
//                                             />
//                                         </BarChart>
//                                     </ChartContainer>
//                                 </CardContent>
//                             </Card>

//                             <Card className="border bg-background/90 shadow-sm">
//                                 <CardHeader>
//                                     <CardTitle>Lines changed</CardTitle>
//                                     <CardDescription>
//                                         Additions, deletions, and net changes.
//                                     </CardDescription>
//                                 </CardHeader>
//                                 <CardContent>
//                                     <ChartContainer
//                                         config={changesChartConfig}
//                                         className="h-64 aspect-auto"
//                                     >
//                                         <LineChart data={dailyData}>
//                                             <CartesianGrid
//                                                 vertical={false}
//                                                 strokeDasharray="3 3"
//                                             />
//                                             <XAxis
//                                                 dataKey="label"
//                                                 tickLine={false}
//                                                 axisLine={false}
//                                                 tickFormatter={(value) =>
//                                                     value.split(",")[0]
//                                                 }
//                                             />
//                                             <YAxis
//                                                 tickLine={false}
//                                                 axisLine={false}
//                                             />
//                                             <ChartTooltip
//                                                 content={
//                                                     <ChartTooltipContent indicator="line" />
//                                                 }
//                                             />
//                                             <Line
//                                                 type="monotone"
//                                                 dataKey="additions"
//                                                 stroke="var(--color-additions)"
//                                                 strokeWidth={2}
//                                                 dot={false}
//                                             />
//                                             <Line
//                                                 type="monotone"
//                                                 dataKey="deletions"
//                                                 stroke="var(--color-deletions)"
//                                                 strokeWidth={2}
//                                                 dot={false}
//                                             />
//                                             <Line
//                                                 type="monotone"
//                                                 dataKey="changes"
//                                                 stroke="var(--color-changes)"
//                                                 strokeWidth={2}
//                                                 dot={false}
//                                             />
//                                         </LineChart>
//                                     </ChartContainer>
//                                 </CardContent>
//                             </Card>
//                         </section>

//                         <Card className="border bg-background/90 shadow-sm">
//                             <CardHeader>
//                                 <CardTitle>Merge requests</CardTitle>
//                                 <CardDescription>
//                                     Weekly merge request contributions.
//                                 </CardDescription>
//                             </CardHeader>
//                             <CardContent className="space-y-3">
//                                 {performance.merge_requests?.length ? (
//                                     performance.merge_requests.map((mr) => (
//                                         <div
//                                             key={`${mr.iid}-${mr.created_at}`}
//                                             className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
//                                         >
//                                             <div>
//                                                 <p className="font-medium">
//                                                     {mr.title}
//                                                 </p>
//                                                 <p className="text-sm text-muted-foreground">
//                                                     #{mr.iid} ·{" "}
//                                                     {safeFormat(
//                                                         mr.created_at,
//                                                     ) ?? "date unavailable"}
//                                                 </p>
//                                                 <p className="text-sm text-muted-foreground">
//                                                     Commits: {mr.commits_count}
//                                                 </p>
//                                             </div>
//                                             <div className="flex flex-wrap items-center gap-2">
//                                                 <Badge variant="outline">
//                                                     {mr.state}
//                                                 </Badge>
//                                                 <Button
//                                                     type="button"
//                                                     variant="ghost"
//                                                     size="sm"
//                                                     className="inline-flex items-center gap-1"
//                                                     asChild
//                                                 >
//                                                     <a
//                                                         href={mr.web_url}
//                                                         target="_blank"
//                                                         rel="noreferrer"
//                                                     >
//                                                         View
//                                                         <ExternalLink className="size-3.5" />
//                                                     </a>
//                                                 </Button>
//                                             </div>
//                                         </div>
//                                     ))
//                                 ) : (
//                                     <EmptyState
//                                         title="No merge requests this week"
//                                         description="We did not find any merge requests for this user during the selected window."
//                                     />
//                                 )}
//                             </CardContent>
//                         </Card>

//                         {performance.llm_prompt_suggestion && (
//                             <Card className="border bg-background/90 shadow-sm">
//                                 <CardHeader>
//                                     <CardTitle>AI insight</CardTitle>
//                                     <CardDescription>
//                                         Generated suggestion based on this
//                                         week&apos;s data.
//                                     </CardDescription>
//                                 </CardHeader>
//                                 <CardContent className="space-y-2">
//                                     <p className="text-sm leading-relaxed text-muted-foreground">
//                                         {performance.llm_prompt_suggestion}
//                                     </p>
//                                     {performance.prompt_tokens ? (
//                                         <p className="text-xs text-muted-foreground">
//                                             Tokens used:{" "}
//                                             {numberFormatter.format(
//                                                 performance.prompt_tokens,
//                                             )}
//                                         </p>
//                                     ) : null}
//                                 </CardContent>
//                             </Card>
//                         )}
//                     </>
//                 ) : (
//                     <EmptyState
//                         title="No performance data"
//                         description="We could not find any contributions for this week. Try selecting a different week or refreshing the stats."
//                     />
//                 )}
//             </div>
//         </div>
//     );
// }

// function createWeekRange(anchor: Date): DateRange {
//     const from = startOfWeek(anchor, { weekStartsOn: WEEK_START_DAY });
//     const to = endOfWeek(anchor, { weekStartsOn: WEEK_START_DAY });
//     return { from, to };
// }

// function safeFormat(value?: string | null) {
//     if (!value) return null;
//     const parsed = new Date(value);
//     if (Number.isNaN(parsed.getTime())) {
//         return null;
//     }
//     return format(parsed, "PP");
// }

// function StatCard({ stat }: { stat: SummaryStat }) {
//     const Icon = stat.icon;
//     return (
//         <Card className="border bg-background/90 shadow-sm">
//             <CardContent className="flex items-center justify-between gap-4 px-6 py-5">
//                 <div>
//                     <p className="text-sm uppercase tracking-wide text-muted-foreground">
//                         {stat.label}
//                     </p>
//                     <p className="text-2xl font-semibold">
//                         {numberFormatter.format(stat.value)}
//                     </p>
//                     <p className="text-sm text-muted-foreground">
//                         {stat.description}
//                     </p>
//                 </div>
//                 <div className="rounded-full bg-primary/10 p-3 text-primary">
//                     <Icon className="size-5" />
//                 </div>
//             </CardContent>
//         </Card>
//     );
// }

// function PerformanceSkeleton() {
//     return (
//         <div className="space-y-3">
//             {Array.from({ length: 3 }, (_, index) => (
//                 <div
//                     key={`performance-skeleton-${index}`}
//                     className="h-44 w-full animate-pulse rounded-2xl border bg-background/60"
//                 />
//             ))}
//         </div>
//     );
// }

// function EmptyState({
//     title,
//     description,
// }: {
//     title: string;
//     description: string;
// }) {
//     return (
//         <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-background/40 px-6 py-16 text-center">
//             <p className="text-lg font-semibold">{title}</p>
//             <p className="max-w-xl text-sm text-muted-foreground">
//                 {description}
//             </p>
//         </div>
//     );
// }
