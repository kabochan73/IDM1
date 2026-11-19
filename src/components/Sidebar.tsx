"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

/** フェーズ画面(設計画面)では画面を広く使いたいので、サイドバーは表示しない。 */
export function Sidebar() {
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
            className="block rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            プロジェクト一覧
          </Link>
        </nav>
      </div>
      <LogoutButton className="rounded-md px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white" />
    </aside>
  );
}
