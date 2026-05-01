"use client";

import { cn } from "@/lib/utils";

interface LoaderProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
}

const sizeMap = {
  xs: "size-3",
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
  xl: "size-16",
};

export function Loader({ size = "sm", className, label }: LoaderProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <img
        src="/loading.svg"
        alt=""
        aria-hidden
        className={cn(sizeMap[size], "select-none")}
        draggable={false}
      />
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </span>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3">
      <img
        src="/loading.svg"
        alt=""
        aria-hidden
        className="size-20 select-none"
        draggable={false}
      />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
