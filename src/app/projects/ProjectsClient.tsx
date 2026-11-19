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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Idea Design Machine</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
          ログアウト
        </button>
      </div>

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新しいプロジェクトのタイトル"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          + 新規プロジェクト
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <ul className="space-y-3">
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div>
              <Link href={`/projects/${project.id}`} className="font-medium text-gray-900 hover:underline">
                {project.title}
              </Link>
              <p className="text-xs text-gray-500">
                {project.doneCount}/{project.totalCount} フェーズ完了
              </p>
            </div>
            <div className="flex gap-3">
              <Link href={`/projects/${project.id}`} className="text-sm text-gray-600 hover:text-gray-900">
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
