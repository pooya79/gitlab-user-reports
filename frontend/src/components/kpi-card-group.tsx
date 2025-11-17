"use client";

import * as React from "react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KPIEntry = {
    name: string;
    description?: string;
    value: React.ReactNode;
};

export type KPICardGroupProps = React.ComponentProps<"section"> & {
    kpis: Record<string, KPIEntry>;
    emptyLabel?: string;
};

export function KPICardGroup({
    kpis,
    className,
    emptyLabel = "No KPIs to display for the selected filters.",
    ...props
}: KPICardGroupProps) {
    const entries = React.useMemo(() => Object.entries(kpis ?? {}), [kpis]);

    if (!entries.length) {
        return (
            <section
                className={cn(
                    "rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground",
                    className,
                )}
                {...props}
            >
                {emptyLabel}
            </section>
        );
    }

    return (
        <section
            className={cn(
                "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
                className,
            )}
            {...props}
        >
            {entries.map(([key, entry]) => (
                <Card key={key} className="h-full">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                            {entry.name}
                        </CardTitle>
                        {entry.description ? (
                            <CardDescription>
                                {entry.description}
                            </CardDescription>
                        ) : null}
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold tracking-tight">
                            {entry.value}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </section>
    );
}
