import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
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
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
