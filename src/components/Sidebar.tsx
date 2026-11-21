"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { CreateProjectModal } from "@/components/CreateProjectModal";

type ProjectSummary = { id: string; title: string };

function LogoMark() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function navItemClass(active: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
    active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
  }`;
}

/** フェーズ画面(設計画面)では画面を広く使いたいので、サイドバーは表示しない。 */
export function Sidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isPhaseScreen = pathname.includes("/phases/");

  if (isPhaseScreen) return null;

  return (
    <aside className="flex w-60 flex-col justify-between bg-gray-900 px-3 py-5 text-gray-100">
      <div>
        <Link href="/projects" className="mb-6 flex items-center gap-2.5 px-2">
          <LogoMark />
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">IDM</p>
            <p className="text-[11px] text-gray-500">Idea Design Machine</p>
          </div>
        </Link>

        <nav className="space-y-1">
          <Link href="/projects" className={navItemClass(pathname === "/projects")}>
            <HomeIcon />
            ホーム
          </Link>
        </nav>

        <div className="mt-5">
          <Link href="/projects" className={navItemClass(false)}>
            <FolderIcon />
            プロジェクト
          </Link>
          <nav className="mt-1 space-y-0.5">
            {projects.map((project) => {
              const href = `/projects/${project.id}`;
              const isActive = pathname === href;
              return (
                <Link key={project.id} href={href} title={project.title} className={navItemClass(isActive)}>
                  {isActive ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
                  ) : (
                    <span className="shrink-0 text-gray-500">
                      <FolderIcon />
                    </span>
                  )}
                  <span className="truncate">{project.title}</span>
                </Link>
              );
            })}
            <button type="button" onClick={() => setShowCreateModal(true)} className={`w-full ${navItemClass(false)}`}>
              <PlusIcon />
              新規プロジェクト
            </button>
          </nav>
        </div>
      </div>
      <LogoutButton className="rounded-lg px-2.5 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white" />
      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}
    </aside>
  );
}
