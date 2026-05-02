import { prisma } from "./db";

interface OwnedOptions {
  // Trash routes need access to deleted rows; default behavior hides them so
  // soft-deleted projects/schemas behave like real deletes for the rest of
  // the app.
  includeDeleted?: boolean;
}

export async function getProjectIfOwned(
  projectId: string,
  userId: string,
  options: OwnedOptions = {}
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: { select: { ownerId: true, id: true } } },
  });
  if (!project || project.workspace.ownerId !== userId) return null;
  if (project.deletedAt && !options.includeDeleted) return null;
  return project;
}

export async function getSchemaIfOwned(
  schemaId: string,
  userId: string,
  options: OwnedOptions = {}
) {
  const schema = await prisma.schema.findUnique({
    where: { id: schemaId },
    include: {
      project: {
        include: { workspace: { select: { ownerId: true, id: true } } },
      },
    },
  });
  if (!schema || schema.project.workspace.ownerId !== userId) return null;
  if (
    !options.includeDeleted &&
    (schema.deletedAt || schema.project.deletedAt)
  ) {
    return null;
  }
  return schema;
}

export async function userOwnsWorkspace(workspaceId: string, userId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  return ws?.ownerId === userId;
}
