"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-context";

const SUFFIX = "Super Schema";

// Updates document.title to reflect the active project/schema so users can
// pick the right tab from a sea of "Super Schema" tabs.
export function ActiveTabTitle() {
  const { projects, activeProjectId, schemas, activeSchemaId } = useWorkspace();
  const project = projects.find((p) => p.id === activeProjectId);
  const schema = schemas.find((s) => s.id === activeSchemaId);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const parts: string[] = [];
    if (schema?.name) parts.push(schema.name);
    if (project?.name && project.name !== schema?.name) parts.push(project.name);
    parts.push(SUFFIX);
    document.title = parts.join(" · ");
  }, [project?.name, schema?.name]);

  return null;
}
