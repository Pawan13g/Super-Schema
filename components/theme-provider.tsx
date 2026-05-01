"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Use a stable default for SSR to avoid hydration mismatches.
      // Disable automatic system detection during SSR to prevent the
      // provider from toggling the `class` on mount and causing a
      // hydration mismatch. Users can still toggle theme manually.
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
