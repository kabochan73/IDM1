"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";

type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  doneCount: number;
  totalCount: number;
};

export function ProjectsClient({ initialProjects }: { initialProjects: ProjectSummary[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    setPending(false);

    if (!res.ok) {
      setError("プロジェクトの作成に失敗しました。");
      return;
    }

    setTitle("");
    router.refresh();
    const data = await res.json();
    setProjects((prev) => [
      { id: data.project.id, title: data.project.title, description: data.project.description, doneCount: 0, totalCount: 8 },
      ...prev,
    ]);
  }

  async function handleDelete(id: string) {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">プロジェクト</h1>
      </div>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新しいプロジェクトのタイトル"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + 新規プロジェクト
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <Link href={`/projects/${project.id}`} className="font-medium text-gray-900 hover:underline">
                {project.title}
              </Link>
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
        {projects.length === 0 && <p className="text-sm text-gray-500">まだプロジェクトがありません。</p>}
      </ul>
    </div>
  );
}
