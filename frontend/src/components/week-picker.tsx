"use client";

import {
    addWeeks,
    endOfWeek,
    format,
    isSameMonth,
    isSameYear,
    startOfWeek,
    subWeeks,
} from "date-fns";
import {
    CalendarIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "lucide-react";
import * as React from "react";
import type { CalendarWeek, DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type WeekPickerConfig = {
    value?: DateRange;
    onChange?: (value: DateRange | undefined) => void;
    weekStartsOn?: WeekStartsOn;
};

type WeekPickerProps = WeekPickerConfig & {
    placeholder?: string;
    className?: string;
    calendarClassName?: string;
    buttonVariant?: React.ComponentProps<typeof Button>["variant"];
    disabled?: boolean;
};

type WeekPickerCalendarProps = WeekPickerConfig & {
    className?: string;
    controller?: WeekPickerController;
    onSelectRange?: (range: DateRange | undefined) => void;
};

function getChangedDate(
    previous: DateRange | undefined,
    next?: DateRange,
): Date | undefined {
    if (!next) return undefined;

    const fromChanged = Boolean(
        next.from && next.from.getTime() !== previous?.from?.getTime(),
    );
    const toChanged = Boolean(
        next.to && next.to.getTime() !== previous?.to?.getTime(),
    );

    if (toChanged) return next.to;
    if (fromChanged) return next.from;
    return next.from ?? next.to;
}

function getWeekRange(date: Date, weekStartsOn: WeekStartsOn): DateRange {
    return {
        from: startOfWeek(date, { weekStartsOn }),
        to: endOfWeek(date, { weekStartsOn }),
    };
}

function useWeekPickerController({
    value,
    onChange,
    weekStartsOn = 1,
}: WeekPickerConfig) {
    const normalizeRange = React.useCallback(
        (input?: DateRange) => {
            if (!input?.from) return undefined;
            return getWeekRange(input.from, weekStartsOn);
        },
        [weekStartsOn],
    );

    const [range, setRangeState] = React.useState<DateRange | undefined>(() =>
        normalizeRange(value),
    );

    React.useEffect(() => {
        setRangeState(normalizeRange(value));
    }, [normalizeRange, value]);

    const setRange = React.useCallback(
        (nextRange?: DateRange) => {
            setRangeState(nextRange);
            onChange?.(nextRange);
        },
        [onChange],
    );

    const goToWeek = React.useCallback(
        (date: Date) => {
            setRange(getWeekRange(date, weekStartsOn));
        },
        [setRange, weekStartsOn],
    );

    const handleSelect = React.useCallback(
        (nextRange?: DateRange) => {
            if (!nextRange) {
                setRange(undefined);
                return;
            }

            const changedDate = getChangedDate(range, nextRange);
            const targetDate = changedDate ?? nextRange.from ?? nextRange.to;
            if (!targetDate) {
                setRange(undefined);
                return;
            }

            setRange(getWeekRange(targetDate, weekStartsOn));
        },
        [range, setRange, weekStartsOn],
    );

    const handleWeekNumberClick = React.useCallback(
        (week: CalendarWeek) => {
            const day = week.days[0];
            if (!day) return;
            goToWeek(day.date);
        },
        [goToWeek],
    );

    const goToPreviousWeek = React.useCallback(() => {
        const base = range?.from ?? startOfWeek(new Date(), { weekStartsOn });
        goToWeek(subWeeks(base, 1));
    }, [goToWeek, range?.from, weekStartsOn]);

    const goToNextWeek = React.useCallback(() => {
        const base = range?.from ?? startOfWeek(new Date(), { weekStartsOn });
        goToWeek(addWeeks(base, 1));
    }, [goToWeek, range?.from, weekStartsOn]);

    return {
        range,
        weekStartsOn,
        setRange,
        handleSelect,
        handleWeekNumberClick,
        goToPreviousWeek,
        goToNextWeek,
    } as const;
}

type WeekPickerController = ReturnType<typeof useWeekPickerController>;

function formatWeekLabel(range: DateRange | undefined, placeholder: string) {
    if (!range?.from || !range?.to) {
        return placeholder;
    }

    const sameYear = isSameYear(range.from, range.to);
    const sameMonth = isSameMonth(range.from, range.to);
    const fromFormat = sameYear ? "MMM d" : "MMM d, yyyy";
    const toFormat = sameYear
        ? sameMonth
            ? "d, yyyy"
            : "MMM d, yyyy"
        : "MMM d, yyyy";

    return `${format(range.from, fromFormat)} - ${format(range.to, toFormat)}`;
}

export function WeekPicker({
    value,
    onChange,
    weekStartsOn,
    placeholder = "Select a week",
    className,
    calendarClassName,
    buttonVariant = "outline",
    disabled,
}: WeekPickerProps) {
    const controller = useWeekPickerController({
        value,
        onChange,
        weekStartsOn,
    });
    const [open, setOpen] = React.useState(false);

    const handleCalendarSelection = React.useCallback((range?: DateRange) => {
        if (range) {
            setOpen(false);
        }
    }, []);

    const label = React.useMemo(
        () => formatWeekLabel(controller.range, placeholder),
        [controller.range, placeholder],
    );

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <div className={cn("inline-flex items-center gap-2", className)}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={controller.goToPreviousWeek}
                    aria-label="Previous week"
                    disabled={disabled}
                >
                    <ChevronLeftIcon className="size-4" aria-hidden="true" />
                </Button>
                <DropdownMenuTrigger asChild disabled={disabled}>
                    <Button
                        type="button"
                        variant={buttonVariant}
                        className="min-w-[14rem] justify-between gap-2 text-left"
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        disabled={disabled}
                    >
                        <span className="text-sm font-medium">{label}</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <CalendarIcon
                                className="size-4"
                                aria-hidden="true"
                            />
                            <ChevronDownIcon
                                className="size-4"
                                aria-hidden="true"
                            />
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={controller.goToNextWeek}
                    aria-label="Next week"
                    disabled={disabled}
                >
                    <ChevronRightIcon className="size-4" aria-hidden="true" />
                </Button>
            </div>
            <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="w-auto border-none bg-transparent p-0 shadow-none"
            >
                <WeekPickerCalendar
                    controller={controller}
                    onSelectRange={handleCalendarSelection}
                    className={cn(
                        "border bg-popover shadow-lg",
                        calendarClassName,
                    )}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function WeekPickerCalendar({
    value,
    onChange,
    weekStartsOn,
    className,
    controller,
    onSelectRange,
}: WeekPickerCalendarProps) {
    const fallbackController = useWeekPickerController({
        value,
        onChange,
        weekStartsOn,
    });
    const state = controller ?? fallbackController;
    const {
        range: selectedRange,
        handleSelect: selectRange,
        handleWeekNumberClick,
        weekStartsOn: stateWeekStartsOn,
    } = state;

    const handleSelect = React.useCallback(
        (nextRange?: DateRange) => {
            selectRange(nextRange);
            const changedDate = getChangedDate(selectedRange, nextRange);
            if (changedDate) {
                onSelectRange?.(getWeekRange(changedDate, stateWeekStartsOn));
            }
        },
        [onSelectRange, selectRange, selectedRange, stateWeekStartsOn],
    );

    const handleWeekNumberSelect = React.useCallback(
        (week: CalendarWeek) => {
            const day = week.days[0];
            if (!day) return;
            handleWeekNumberClick(week);
            onSelectRange?.(getWeekRange(day.date, stateWeekStartsOn));
        },
        [handleWeekNumberClick, onSelectRange, stateWeekStartsOn],
    );

    return (
        <Calendar
            mode="range"
            selected={state.range}
            showWeekNumber
            onSelect={handleSelect}
            weekStartsOn={stateWeekStartsOn}
            components={{
                WeekNumber: ({ week, ...props }) => (
                    <td {...props}>
                        <button
                            type="button"
                            className="flex size-[--cell-size] items-center justify-center rounded-md text-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => handleWeekNumberSelect(week)}
                            aria-label={`Select week ${week.weekNumber}`}
                        >
                            {week.weekNumber}
                        </button>
                    </td>
                ),
            }}
            className={cn("rounded-lg border", className)}
        />
    );
}

export { WeekPickerCalendar };
