import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative",
        month: "space-y-4",
        caption: "grid grid-cols-[2rem_1fr_2rem] items-center pt-1",
        caption_label: "text-sm font-medium text-center",
        nav: "absolute top-1 left-1 right-1 flex items-center justify-between z-10 pointer-events-none",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 bg-background border-border text-foreground opacity-100 shadow-sm pointer-events-auto"
        ),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 bg-background border-border text-foreground opacity-100 shadow-sm pointer-events-auto"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 bg-background border-border text-foreground opacity-100 shadow-sm pointer-events-auto"
        ),
        nav_button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 bg-background border-border text-foreground opacity-100 shadow-sm pointer-events-auto"
        ),
        nav_button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 p-0 bg-background border-border text-foreground opacity-100 shadow-sm pointer-events-auto"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "text-muted-foreground rounded-md h-9 flex items-center justify-center font-normal text-[0.8rem]",
        weeks: "mt-2 space-y-1",
        week: "grid grid-cols-7 gap-1",
        day: "h-9 w-9 p-0 text-center text-sm relative",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        cell: "h-9 w-9 p-0 text-center text-sm relative",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
