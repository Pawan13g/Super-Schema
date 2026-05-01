import { SchemaProvider } from "@/lib/schema-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { ShortcutsOverlay } from "@/components/workspace/shortcuts-overlay";
import { CommandPalette } from "@/components/workspace/command-palette";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SchemaProvider>
      <WorkspaceProvider>
        {children}
        <ShortcutsOverlay />
        <CommandPalette />
      </WorkspaceProvider>
    </SchemaProvider>
  );
}
