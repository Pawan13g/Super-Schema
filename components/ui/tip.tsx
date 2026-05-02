"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TipProps {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  children: ReactNode;
}

// Compact tooltip wrapper. Wraps the trigger child with Tooltip + Trigger
// (using `render` so the child element keeps its own DOM identity), and
// shows `label` on hover/focus. Relies on the global TooltipProvider.
export function Tip({ label, side = "top", sideOffset = 6, children }: TipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children as React.ReactElement} />
      <TooltipContent side={side} sideOffset={sideOffset}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
