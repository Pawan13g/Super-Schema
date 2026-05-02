"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { useWorkspace } from "@/lib/workspace-context";
import { useSchema } from "@/lib/schema-store";
import type { Schema } from "@/lib/types";
import { toast } from "sonner";
import {
  AlertTriangle,
  Database,
  Eye,
  EyeOff,
  Plug,
  ShieldCheck,
} from "lucide-react";

type Dialect = "postgresql" | "mysql";

interface ConnectDbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER: Record<Dialect, string> = {
  postgresql: "postgres://user:pass@host:5432/dbname",
  mysql: "mysql://user:pass@host:3306/dbname",
};

export function ConnectDbDialog({ open, onOpenChange }: ConnectDbDialogProps) {
  const { activeProjectId, createSchemaInProject, saveNow } = useWorkspace();
  const { replaceSchema } = useSchema();

  const [dialect, setDialect] = useState<Dialect>("postgresql");
  const [conn, setConn] = useState("");
  const [showConn, setShowConn] = useState(false);
  const [busy, setBusy] = useState<"test" | "import" | null>(null);
  const [preview, setPreview] = useState<Schema | null>(null);
  const [importName, setImportName] = useState("Imported schema");

  const reset = () => {
    setConn("");
    setPreview(null);
    setImportName("Imported schema");
    setBusy(null);
  };

  const introspect = async (): Promise<Schema | null> => {
    if (!conn.trim()) {
      toast.error("Enter a connection string");
      return null;
    }
    const res = await fetch("/api/introspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialect, connectionString: conn.trim() }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error ?? "Connection failed");
      return null;
    }
    const data = (await res.json()) as { schema: Schema };
    return data.schema;
  };

  const handleTest = async () => {
    setBusy("test");
    try {
      const schema = await introspect();
      if (!schema) return;
      setPreview(schema);
      toast.success(
        `Connected — ${schema.tables.length} tables, ${schema.relations.length} relations`
      );
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy("import");
    try {
      const schema = preview ?? (await introspect());
      if (!schema) return;
      if (!activeProjectId) {
        toast.error("No active project");
        return;
      }
      const created = await createSchemaInProject(importName.trim() || "Imported");
      if (!created) {
        toast.error("Failed to create schema");
        return;
      }
      // createSchemaInProject already switched to the new schema (loading its
      // empty schemaJson). Replace canvas state with the introspected schema,
      // then force-flush the save so the import survives a reload — the
      // debounced auto-save can be eaten by the load's skip-next-autosave
      // flag, leaving only an empty schema on the server.
      replaceSchema(schema);
      // Yield a tick so the schema-store state update commits before saveNow
      // reads the schema via its ref.
      await new Promise((r) => setTimeout(r, 0));
      await saveNow();
      toast.success(
        `Imported ${schema.tables.length} table${schema.tables.length === 1 ? "" : "s"}`
      );
      reset();
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="size-4" />
            Connect to live database
          </DialogTitle>
          <DialogDescription>
            Read schema from a running PostgreSQL or MySQL instance. Read-only —
            credentials are used once for the connection and never stored.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label className="text-xs">Database</Label>
            <Tabs value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
              <TabsList className="h-8">
                <TabsTrigger value="postgresql" className="gap-1 px-3 text-xs">
                  <Database className="size-3" />
                  PostgreSQL
                </TabsTrigger>
                <TabsTrigger value="mysql" className="gap-1 px-3 text-xs">
                  <Database className="size-3" />
                  MySQL
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="conn-str" className="text-xs">
              Connection string
            </Label>
            <div className="relative">
              <Input
                id="conn-str"
                type={showConn ? "text" : "password"}
                value={conn}
                onChange={(e) => {
                  setConn(e.target.value);
                  setPreview(null);
                }}
                placeholder={PLACEHOLDER[dialect]}
                className="pr-9 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowConn((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                title={showConn ? "Hide" : "Show"}
                tabIndex={-1}
              >
                {showConn ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" />
              Sent over HTTPS to your Super Schema server, used to make a single
              read-only connection, then discarded. Not persisted.
            </p>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Tables" value={preview.tables.length} />
                <Stat label="Relations" value={preview.relations.length} />
                <Stat
                  label="Columns"
                  value={preview.tables.reduce(
                    (s, t) => s + t.columns.length,
                    0
                  )}
                />
              </div>
              <div className="mt-3 grid gap-1.5">
                <Label className="text-xs">Save as</Label>
                <Input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Imported schema"
                />
              </div>
            </div>
          )}

          {!activeProjectId && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-2 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              No active project. Select one before importing.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy !== null}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || !conn.trim()}
          >
            {busy === "test" ? <Loader size="xs" /> : <Plug className="size-3.5" />}
            Test connection
          </Button>
          <Button
            onClick={handleImport}
            disabled={busy !== null || !conn.trim() || !activeProjectId}
          >
            {busy === "import" ? <Loader size="xs" /> : null}
            {preview ? "Import as new schema" : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
