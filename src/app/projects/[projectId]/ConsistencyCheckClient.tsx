"use client";

import { useState } from "react";

type Finding = {
  severity: "low" | "medium" | "high";
  phasesInvolved: string[];
  description: string;
  suggestion?: string;
};
type Result = { findings: Finding[]; summary: string };

const SEVERITY_LABEL: Record<Finding["severity"], string> = { high: "高", medium: "中", low: "低" };
const SEVERITY_CLASS: Record<Finding["severity"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-50 text-gray-600 border-gray-200",
};
const SEVERITY_ORDER: Record<Finding["severity"], number> = { high: 0, medium: 1, low: 2 };

export function ConsistencyCheckClient({ projectId, initialResult }: { projectId: string; initialResult: Result | null }) {
  const [result, setResult] = useState(initialResult);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/consistency-check`, { method: "POST" });
    setRunning(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "整合性チェックに失敗しました。");
      return;
    }

    const data = await res.json();
    setResult(data.result);
  }

  const sortedFindings = result ? [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">整合性チェック</h2>
        <button
          onClick={handleRun}
          disabled={running}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {running ? "確認中..." : "整合性チェックを実行"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!result && !error && <p className="text-sm text-gray-400">まだ実行していません。</p>}

      {result && (
        <div>
          <p className="mb-3 text-sm text-gray-700">{result.summary}</p>
          {sortedFindings.length === 0 ? (
            <p className="text-sm text-green-700">矛盾は見つかりませんでした。</p>
          ) : (
            <ul className="space-y-2">
              {sortedFindings.map((f, i) => (
                <li key={i} className={`rounded-md border p-3 text-sm ${SEVERITY_CLASS[f.severity]}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">
                      重要度: {SEVERITY_LABEL[f.severity]}
                    </span>
                    <span className="text-xs opacity-80">{f.phasesInvolved.join(" / ")}</span>
                  </div>
                  <p>{f.description}</p>
                  {f.suggestion && <p className="mt-1 text-xs opacity-80">提案: {f.suggestion}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
