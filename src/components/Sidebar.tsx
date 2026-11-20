"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

type ProjectSummary = { id: string; title: string };

/** フェーズ画面(設計画面)では画面を広く使いたいので、サイドバーは表示しない。 */
export function Sidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();
  const isPhaseScreen = pathname.includes("/phases/");

  if (isPhaseScreen) return null;

  return (
    <aside className="flex w-56 flex-col justify-between bg-gray-900 px-4 py-6 text-gray-100">
      <div>
        <Link href="/projects" className="mb-8 block text-sm font-semibold text-white">
          Idea Design Machine
        </Link>
        <nav className="space-y-1">
          <Link
            href="/projects"
            className={`block rounded-md px-3 py-2 text-sm hover:bg-gray-800 hover:text-white ${
              pathname === "/projects" ? "bg-gray-800 text-white" : "text-gray-300"
            }`}
          >
            プロジェクト一覧
          </Link>
        </nav>

        {projects.length > 0 && (
          <div className="mt-6">
            <p className="mb-1 px-3 text-xs font-medium tracking-wide text-gray-500">最近のプロジェクト</p>
            <nav className="space-y-0.5">
              {projects.map((project) => {
                const href = `/projects/${project.id}`;
                const isActive = pathname === href;
                return (
                  <Link
                    key={project.id}
                    href={href}
                    title={project.title}
                    className={`block truncate rounded-md px-3 py-1.5 text-sm hover:bg-gray-800 hover:text-white ${
                      isActive ? "bg-gray-800 text-white" : "text-gray-400"
                    }`}
                  >
                    {project.title}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
      <LogoutButton className="rounded-md px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white" />
    </aside>
  );
}
