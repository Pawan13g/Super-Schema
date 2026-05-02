import { SchemaProvider } from "@/lib/schema-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { PanelLayoutProvider } from "@/lib/panel-layout";
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
        <PanelLayoutProvider>
          {/* Lock the app shell to the viewport — no body-level scroll. */}
          <div className="flex h-screen w-screen flex-col overflow-hidden">
            {children}
          </div>
          <ShortcutsOverlay />
          <CommandPalette />
        </PanelLayoutProvider>
      </WorkspaceProvider>
    </SchemaProvider>
  );
}
