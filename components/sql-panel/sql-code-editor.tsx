"use client";

import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { sql, PostgreSQL, MySQL, StandardSQL, MSSQL, SQLite } from "@codemirror/lang-sql";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
// IMPORTANT: this app uses its own ThemeProvider (`components/theme-provider`)
// and NOT next-themes. Always import `useTheme` from the project provider —
// the next-themes hook returns a stale value because the provider context
// never matches.
import { useTheme } from "@/components/theme-provider";
import type { SqlImportDialect } from "@/lib/sql-import";

interface SqlCodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  dialect?: SqlImportDialect;
}

// Maps our SqlImportDialect onto CodeMirror's lang-sql variants for accurate
// keyword highlighting and identifier rules. `auto` falls back to the
// generic StandardSQL grammar.
function dialectFor(d?: SqlImportDialect) {
  switch (d) {
    case "postgresql":
      return PostgreSQL;
    case "mysql":
      return MySQL;
    case "sqlite":
      return SQLite;
    case "mssql":
      return MSSQL;
    default:
      return StandardSQL;
  }
}

// VSCode-themed CodeMirror 6 SQL editor. Replaces the old transparent-
// textarea overlay hack that suffered from caret/highlight misalignment, no
// line numbers, no proper undo history, and broken selection on long lines.
//
// Features:
// - Per-dialect syntax highlighting with VSCode dark / light theme.
// - Line numbers + active-line highlight + fold gutter.
// - Bracket matching + auto-close pairs.
// - Multi-cursor (Alt+click), find (Ctrl+F), undo/redo (Ctrl+Z / Ctrl+Y).
// - Keyword autocomplete (Ctrl+Space), rectangular selection.
// - Tab indents 2 spaces, soft-wrap on long lines.
export function SqlCodeEditor({
  value,
  onChange,
  disabled,
  placeholder,
  dialect,
}: SqlCodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? vscodeDark : vscodeLight;

  // Override CodeMirror's hard-coded backgrounds so the editor matches the
  // surrounding panel (`var(--color-background)`). VSCode's own dark grey
  // looks lighter than this app's deep-black panel and stands out
  // visually. Selectors target both the wrapper, the gutters, and the
  // active-line stripe so nothing leaks the original colour.
  const surfaceTheme = useMemo(
    () =>
      EditorView.theme({
        "&": {
          backgroundColor: "var(--color-background)",
          color: "var(--color-foreground)",
        },
        ".cm-scroller": { backgroundColor: "var(--color-background)" },
        ".cm-gutters": {
          backgroundColor: "var(--color-background)",
          borderRight: "1px solid var(--color-border)",
          color: "var(--color-muted-foreground)",
        },
        ".cm-activeLine": {
          backgroundColor: "color-mix(in oklab, var(--color-foreground) 6%, transparent)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "color-mix(in oklab, var(--color-foreground) 6%, transparent)",
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          backgroundColor: "color-mix(in oklab, var(--color-primary) 30%, transparent) !important",
        },
        ".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
      }),
    []
  );

  return (
    // h-full + min-h-0 lets this editor honour the surrounding flex column's
    // height so the parent's footer (Clear / Import buttons) stays pinned at
    // the bottom regardless of how many lines the user types. CodeMirror
    // itself owns the scrollbar; height="100%" makes it fill the wrapper.
    <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={disabled}
        placeholder={placeholder}
        height="100%"
        theme={theme}
        extensions={[
          sql({ dialect: dialectFor(dialect), upperCaseKeywords: true }),
          EditorView.lineWrapping,
          // Order matters: surface override comes AFTER the base theme
          // (`theme` prop applied first by react-codemirror) so our
          // background wins over vscodeDark's defaults.
          surfaceTheme,
        ]}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          searchKeymap: true,
          tabSize: 2,
        }}
        style={{ width: "100%", height: "100%", fontSize: 12 }}
      />
    </div>
  );
}
