"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { getPhaseConfig } from "@/lib/phases";
import { STATUS_DOT_CLASS } from "@/lib/phaseStatus";
import type { Phase } from "@/generated/prisma/client";

type ProjectSummary = { id: string; title: string };
type ProjectDetail = { id: string; title: string; phases: Phase[] };

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

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function navItemClass(active: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
    active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
  }`;
}

function GlobalNav({
  pathname,
  projects,
  onCreateClick,
}: {
  pathname: string;
  projects: ProjectSummary[];
  onCreateClick: () => void;
}) {
  return (
    <div>
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
          <button type="button" onClick={onCreateClick} className={`w-full ${navItemClass(false)}`}>
            <PlusIcon />
            新規プロジェクト
          </button>
        </nav>
      </div>
    </div>
  );
}

function ProjectNav({ pathname, project }: { pathname: string; project: ProjectDetail }) {
  const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);

  return (
    <div>
      <Link href="/projects" className={navItemClass(false)}>
        <BackIcon />
        プロジェクト一覧
      </Link>
      <p className="mt-4 mb-1 truncate px-2.5 text-xs font-medium tracking-wide text-gray-500" title={project.title}>
        {project.title}
      </p>
      <nav className="space-y-0.5">
        {sortedPhases.map((phase) => {
          const config = getPhaseConfig(phase.type);
          const href = `/projects/${project.id}/phases/${phase.type.toLowerCase()}`;
          const reachable = phase.status !== "NOT_STARTED";
          const content = (
            <>
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[phase.status]}`} />
              <span className="truncate">
                {config.order}. {config.labelJa}
              </span>
            </>
          );
          return reachable ? (
            <Link key={phase.id} href={href} className={navItemClass(pathname === href)}>
              {content}
            </Link>
          ) : (
            <span key={phase.id} className={`${navItemClass(false)} opacity-50`}>
              {content}
            </span>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);

  // プロジェクト詳細ページ(/projects/[id])とフェーズ画面(/projects/[id]/phases/[type])の
  // 両方でプロジェクトモード(このプロジェクトの8フェーズ一覧)にする。
  const projectModeMatch = /^\/projects\/([^/]+)(?:\/phases\/.+)?$/.exec(pathname);
  const projectId = projectModeMatch?.[1] ?? null;

  useEffect(() => {
    // projectIdがnullの間は何もしない。表示側は`projectDetail?.id === projectId`で
    // 「今のページと一致するデータだけ」を使うので、ここで明示的にnullへリセットする必要はない。
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.project) setProjectDetail(data.project);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

        {projectId && projectDetail && projectDetail.id === projectId ? (
          <ProjectNav pathname={pathname} project={projectDetail} />
        ) : (
          <GlobalNav pathname={pathname} projects={projects} onCreateClick={() => setShowCreateModal(true)} />
        )}
      </div>
      <LogoutButton className="rounded-lg px-2.5 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white" />
      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}
    </aside>
  );
}
