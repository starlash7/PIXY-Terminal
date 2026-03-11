"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

type WorkspaceFrameProps = {
  children: React.ReactNode;
};

export function WorkspaceFrame({ children }: WorkspaceFrameProps) {
  const pathname = usePathname();
  const immersiveChat = pathname === "/chat";

  if (immersiveChat) {
    return (
      <div className="min-h-screen min-w-[1024px] bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-[1024px] bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <TopBar />
      <div className="grid min-h-[calc(100vh-3rem)] grid-cols-[14rem_minmax(0,1fr)]">
        <Sidebar />
        <main className="min-w-0 bg-[var(--bg-primary)]">{children}</main>
      </div>
    </div>
  );
}
