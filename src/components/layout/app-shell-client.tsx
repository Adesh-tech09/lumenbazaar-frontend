"use client";

import { useRouteChangeFocus } from "@/hooks/useRouteChangeFocus";

type AppShellClientProps = {
  children: React.ReactNode;
};

/**
 * AppShellClient: Client-side wrapper for AppShell that handles focus management.
 * 
 * Manages focus restoration after route changes, ensuring keyboard and screen
 * reader users maintain focus on meaningful content.
 */
export function AppShellClient({ children }: AppShellClientProps) {
  useRouteChangeFocus();

  return <>{children}</>;
}
