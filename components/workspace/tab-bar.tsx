"use client";

import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileText, X } from "lucide-react";

interface TabBarProps {
  // VSCode-style tab strip rendered above the canvas. Each tab represents an
  // open schema; clicking switches the canvas to it. Tabs span projects so
  // the user can flip between work in different projects without losing
  // context.
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const {
    openTabs,
    activeSchemaId,
    switchSchema,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    activeProjectId,
    switchProject,
  } = useWorkspace();
  const { saveNow } = useWorkspace();

  if (openTabs.length === 0) return null;

  const handleClick = async (
    schemaId: string,
    projectId: string
  ) => {
    if (projectId !== activeProjectId) {
      await switchProject(projectId);
    }
    if (schemaId !== activeSchemaId) {
      await switchSchema(schemaId);
    }
  };

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-card/40 backdrop-blur-sm scrollbar-thin",
        className
      )}
    >
      {openTabs.map((tab) => {
        const isActive = tab.schemaId === activeSchemaId;
        return (
          <div
            key={tab.schemaId}
            role="button"
            tabIndex={0}
            onClick={() => handleClick(tab.schemaId, tab.projectId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handleClick(tab.schemaId, tab.projectId);
              }
            }}
            onAuxClick={(e) => {
              // Middle-click closes the tab (browser-style).
              if (e.button === 1) {
                e.preventDefault();
                if (isActive) void saveNow();
                closeTab(tab.schemaId);
              }
            }}
            className={cn(
              "group/tab relative flex min-w-[140px] max-w-[240px] cursor-pointer items-center gap-1.5 border-r px-3 text-[12px] transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <FileText
              className={cn(
                "size-3 shrink-0",
                isActive ? "text-emerald-500" : "text-muted-foreground/70"
              )}
            />
            <Tip label={`${tab.projectName} / ${tab.schemaName}`}>
              <span className="min-w-0 flex-1 truncate font-medium">
                {tab.schemaName}
              </span>
            </Tip>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isActive) void saveNow();
                closeTab(tab.schemaId);
              }}
              className={cn(
                "ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded transition-opacity hover:bg-foreground/10",
                isActive ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100"
              )}
              aria-label={`Close ${tab.schemaName}`}
              tabIndex={-1}
            >
              <X className="size-3" />
            </button>
            {/* Active underline */}
            {isActive && (
              <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
            )}
          </div>
        );
      })}

      {/* Tab strip dropdown — close-others / close-all */}
      <div className="ml-auto flex shrink-0 items-center pr-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                title="Tab actions"
                className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            {openTabs.map((t) => (
              <DropdownMenuItem
                key={t.schemaId}
                onClick={() => handleClick(t.schemaId, t.projectId)}
              >
                <FileText
                  className={cn(
                    "size-3",
                    t.schemaId === activeSchemaId
                      ? "text-emerald-500"
                      : "text-muted-foreground"
                  )}
                />
                <span className="truncate">{t.schemaName}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {t.projectName}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {activeSchemaId && (
              <DropdownMenuItem
                onClick={() => closeOtherTabs(activeSchemaId)}
                disabled={openTabs.length < 2}
              >
                Close other tabs
              </DropdownMenuItem>
            )}
            <DropdownMenuItem destructive onClick={() => closeAllTabs()}>
              Close all tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
