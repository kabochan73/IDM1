"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  doneCount: number;
  totalCount: number;
  currentPhaseLabel: string;
};

export function ProjectsClient({ initialProjects }: { initialProjects: ProjectSummary[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [prevInitialProjects, setPrevInitialProjects] = useState(initialProjects);

  // サイドバーのモーダルで新規作成された場合など、サーバー側のデータ(props)が更新されたら追従する。
  // (レンダー中に同期することで、useEffectによる余分な再描画を避ける)
  if (initialProjects !== prevInitialProjects) {
    setPrevInitialProjects(initialProjects);
    setProjects(initialProjects);
  }

  async function handleDelete(id: string) {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">プロジェクト</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div>
              <Link href={`/projects/${project.id}`} className="font-medium text-gray-900 hover:underline">
                {project.title}
              </Link>
              <p className="mt-1 text-sm text-brand-700">{project.currentPhaseLabel}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-brand-600"
                  style={{ width: `${(project.doneCount / project.totalCount) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {project.doneCount}/{project.totalCount} フェーズ完了
              </p>
            </div>
            <div className="mt-3 flex justify-end gap-3">
              <Link href={`/projects/${project.id}`} className="text-sm text-brand-600 hover:text-brand-700">
                開く
              </Link>
              <button onClick={() => handleDelete(project.id)} className="text-sm text-red-500 hover:text-red-700">
                削除
              </button>
            </div>
          </li>
        ))}
        {projects.length === 0 && <p className="text-sm text-gray-500">まだプロジェクトがありません。サイドバーの「+ 新規プロジェクト」から作成できます。</p>}
      </ul>
    </div>
  );
}
