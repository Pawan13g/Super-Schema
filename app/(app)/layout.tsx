import { SchemaProvider } from "@/lib/schema-store";
import { WorkspaceProvider } from "@/lib/workspace-context";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SchemaProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </SchemaProvider>
  );
}
