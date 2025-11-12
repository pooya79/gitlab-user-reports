"use client";

import * as React from "react";
import { endOfWeek, startOfWeek } from "date-fns";
import type { CalendarWeek, DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type WeekPickerProps = {
    value?: DateRange;
    onChange?: (value: DateRange | undefined) => void;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    className?: string;
};

export function WeekPicker({
    value,
    onChange,
    weekStartsOn = 1,
    className,
}: WeekPickerProps) {
    const [range, setRange] = React.useState<DateRange | undefined>(value);

    const syncKey = React.useMemo(
        () =>
            value
                ? `${value.from?.getTime() ?? "null"}-${value.to?.getTime() ?? "null"}`
                : "undefined",
        [value],
    );

    React.useEffect(() => {
        setRange(value);
    }, [syncKey]);

    const emitChange = React.useCallback(
        (nextRange: DateRange | undefined) => {
            setRange(nextRange);
            onChange?.(nextRange);
        },
        [onChange],
    );

    const normalizeRange = React.useCallback(
        (input?: DateRange) => {
            if (!input?.from) return undefined;
            const from = startOfWeek(input.from, { weekStartsOn });
            const to = endOfWeek(input.from, { weekStartsOn });
            return { from, to };
        },
        [weekStartsOn],
    );

    const handleSelect = React.useCallback(
        (nextRange?: DateRange) => {
            emitChange(normalizeRange(nextRange));
        },
        [emitChange, normalizeRange],
    );

    const handleWeekNumberClick = React.useCallback(
        (week: CalendarWeek) => {
            const baseDate = week.dates[0];
            const from = startOfWeek(baseDate, { weekStartsOn });
            const to = endOfWeek(baseDate, { weekStartsOn });
            emitChange({ from, to });
        },
        [emitChange, weekStartsOn],
    );

    return (
        <Calendar
            mode="range"
            selected={range}
            showWeekNumber
            onSelect={handleSelect}
            weekStartsOn={weekStartsOn}
            components={{
                WeekNumber: ({ week, ...props }) => (
                    <td
                        {...props}
                        className="cursor-pointer text-center text-muted-foreground transition hover:text-foreground"
                        onClick={() => handleWeekNumberClick(week)}
                    >
                        <div className="flex size-[--cell-size] items-center justify-center">
                            {week.number}
                        </div>
                    </td>
                ),
            }}
            className={cn("rounded-lg border", className)}
        />
    );
}
