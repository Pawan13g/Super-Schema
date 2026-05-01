import { prisma } from "./db";

export async function getProjectIfOwned(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: { select: { ownerId: true, id: true } } },
  });
  if (!project || project.workspace.ownerId !== userId) return null;
  return project;
}

export async function getSchemaIfOwned(schemaId: string, userId: string) {
  const schema = await prisma.schema.findUnique({
    where: { id: schemaId },
    include: {
      project: {
        include: { workspace: { select: { ownerId: true, id: true } } },
      },
    },
  });
  if (!schema || schema.project.workspace.ownerId !== userId) return null;
  return schema;
}

export async function userOwnsWorkspace(workspaceId: string, userId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  return ws?.ownerId === userId;
}
