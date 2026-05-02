"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommentPopoverProps {
  comment: string;
  onSave: (next: string) => void;
  label: string;
  placeholder?: string;
  trigger: ReactNode;
}

// Inline-editable comment with autosave-on-blur. Click the trigger to open;
// changes commit when the popover closes or Cmd/Ctrl+Enter is pressed. Esc
// discards. Used by table-node hover indicators.
export function CommentPopover({
  comment,
  onSave,
  label,
  placeholder = "Write a short note",
  trigger,
}: CommentPopoverProps) {
  const [open, setOpen] = useState(false);
  // Editor pushes pending text via this ref before unmount on outside-click.
  const flushRef = useRef<() => void>(() => {});
  // `key` remount on open seeds draft from latest comment without an effect.
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) flushRef.current();
        setOpen(v);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center"
          />
        }
      >
        {trigger}
      </PopoverTrigger>
      {open && (
        <CommentEditor
          key={comment}
          initial={comment}
          label={label}
          placeholder={placeholder}
          onClose={() => setOpen(false)}
          onSave={onSave}
          flushRef={flushRef}
        />
      )}
    </Popover>
  );
}

interface CommentEditorProps {
  initial: string;
  label: string;
  placeholder: string;
  onClose: () => void;
  onSave: (next: string) => void;
  flushRef: React.MutableRefObject<() => void>;
}

function CommentEditor({
  initial,
  label,
  placeholder,
  onClose,
  onSave,
  flushRef,
}: CommentEditorProps) {
  const [draft, setDraft] = useState(initial);
  const dirtyRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount.
  useEffect(() => {
    const t = setTimeout(() => taRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Always read latest draft via ref so the parent's outside-click flush
  // commits the most recent edit (closure on `draft` would be stale).
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const commit = useCallback(() => {
    if (!dirtyRef.current) return;
    const next = draftRef.current.trim();
    if (next !== initial.trim()) onSave(next);
    dirtyRef.current = false;
  }, [initial, onSave]);
  useEffect(() => {
    flushRef.current = commit;
  }, [commit, flushRef]);

  const closeWithCommit = () => {
    commit();
    onClose();
  };

  return (
    <PopoverContent
      className="w-72 p-0"
      side="top"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <MessageSquare className="size-3" />
          {label}
        </span>
        {initial.trim() && (
          <button
            type="button"
            onClick={() => {
              dirtyRef.current = false;
              onSave("");
              onClose();
            }}
            title="Clear comment"
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          dirtyRef.current = true;
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            closeWithCommit();
          }
          if (e.key === "Escape") {
            dirtyRef.current = false;
            onClose();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className={cn(
          "min-h-[88px] w-full resize-none rounded-b-xl bg-popover p-3 text-xs leading-relaxed outline-none",
          "placeholder:text-muted-foreground/60"
        )}
      />
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>
          <kbd className="rounded border bg-background px-1 py-px font-mono">⌘</kbd>{" "}
          <kbd className="rounded border bg-background px-1 py-px font-mono">↵</kbd>{" "}
          save
        </span>
        <Button size="xs" variant="ghost" onClick={closeWithCommit}>
          <Check className="size-3" />
          Done
        </Button>
      </div>
    </PopoverContent>
  );
}
