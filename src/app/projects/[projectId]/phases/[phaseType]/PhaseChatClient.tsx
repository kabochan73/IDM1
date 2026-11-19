"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { structuredListToMarkdown } from "@/lib/deliverableToMarkdown";

const FINALIZE_MARKER = "\u0000FINALIZE_READY\u0000";

type ChatMessageView = { role: "USER" | "ASSISTANT"; content: string };
type StructuredItem = { id: string; title: string; description: string; priority: string };

export function PhaseChatClient({
  projectId,
  phaseType,
  phaseLabel,
  phaseStatus,
  initialMessages,
  initialDeliverable,
}: {
  projectId: string;
  phaseType: string;
  phaseLabel: string;
  phaseStatus: string;
  initialMessages: ChatMessageView[];
  initialDeliverable: { items: StructuredItem[] } | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [readyToFinalize, setReadyToFinalize] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [deliverable, setDeliverable] = useState(initialDeliverable);
  const [view, setView] = useState<"structured" | "markdown">("structured");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(phaseStatus);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StructuredItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function handleCopyMarkdown() {
    if (!deliverable) return;
    await navigator.clipboard.writeText(structuredListToMarkdown(deliverable));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveItems(items: StructuredItem[]) {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/deliverable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSaving(false);

    if (!res.ok) {
      alert("保存に失敗しました。");
      return;
    }

    setDeliverable({ items });
    setEditingId(null);
    setEditDraft(null);
    router.refresh();
  }

  function startEdit(item: StructuredItem) {
    setEditingId(item.id);
    setEditDraft({ ...item });
  }

  function handleSaveEdit() {
    if (!deliverable || !editDraft) return;
    const items = deliverable.items.map((i) => (i.id === editDraft.id ? editDraft : i));
    saveItems(items);
  }

  function handleDelete(id: string) {
    if (!deliverable) return;
    if (!confirm("この項目を削除しますか？")) return;
    saveItems(deliverable.items.filter((i) => i.id !== id));
  }

  function handleAddItem() {
    if (!deliverable) return;
    const newItem: StructuredItem = { id: `NEW-${Date.now()}`, title: "", description: "", priority: "Must" };
    setDeliverable({ items: [...deliverable.items, newItem] });
    startEdit(newItem);
  }

  async function handleResolveReview() {
    setResolving(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/resolve-review`, { method: "POST" });
    setResolving(false);
    if (!res.ok) {
      alert("操作に失敗しました。");
      return;
    }
    setStatus("DONE");
    router.refresh();
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "USER", content: text }]);
    setMessages((prev) => [...prev, { role: "ASSISTANT", content: "" }]);

    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok || !res.body) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ASSISTANT", content: "(エラー: AIとの通信に失敗しました)" };
        return next;
      });
      setSending(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const markerIndex = buffer.indexOf(FINALIZE_MARKER);
      const visible = markerIndex === -1 ? buffer : buffer.slice(0, markerIndex);

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ASSISTANT", content: visible };
        return next;
      });

      if (markerIndex !== -1) {
        const jsonPart = buffer.slice(markerIndex + FINALIZE_MARKER.length);
        try {
          const parsed = JSON.parse(jsonPart) as { rationale?: string };
          setReadyToFinalize(parsed.rationale ?? "この内容で確定できそうです。");
        } catch {
          setReadyToFinalize("この内容で確定できそうです。");
        }
      }
    }

    setSending(false);
  }

  async function handleFinalize() {
    setFinalizing(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/finalize`, { method: "POST" });
    setFinalizing(false);

    if (!res.ok) {
      alert("確定に失敗しました。");
      return;
    }

    const data = await res.json();
    setDeliverable(data.content);
    setReadyToFinalize(null);
    setStatus("DONE");
    router.refresh();
  }

  const statusLabel: Record<string, string> = {
    NOT_STARTED: "未着手",
    IN_PROGRESS: "進行中",
    DONE: "完了",
    NEEDS_REVIEW: "要見直し",
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2">
      <div className="flex flex-col rounded-lg border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h1 className="text-sm font-semibold text-gray-900">{phaseLabel}フェーズ</h1>
          <span className="text-xs text-gray-500">{statusLabel[status]}</span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: "60vh" }}>
          {messages.map((m, i) => (
            <div key={i} className={m.role === "USER" ? "text-right" : "text-left"}>
              <span
                className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "USER" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                {m.content || "…"}
              </span>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-gray-400">AIとのチャットでヒアリングが始まります。</p>}
        </div>

        {readyToFinalize && (
          <div className="border-t border-gray-200 bg-amber-50 px-4 py-3">
            <p className="mb-2 text-sm text-gray-800">{readyToFinalize}</p>
            <div className="flex gap-2">
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {finalizing ? "確定中..." : "確定する"}
              </button>
              <button
                onClick={() => setReadyToFinalize(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
              >
                まだ続ける
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-200 p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="メッセージを入力"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        {status === "NEEDS_REVIEW" && (
          <div className="mb-3 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
            <p className="text-sm text-amber-800">上流フェーズが変更されました。内容を確認してください。</p>
            <button
              onClick={handleResolveReview}
              disabled={resolving}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {resolving ? "処理中..." : "問題なし"}
            </button>
          </div>
        )}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">成果物</h2>
          {deliverable && (
            <div className="flex gap-1 rounded-md bg-gray-100 p-0.5 text-xs">
              <button
                onClick={() => setView("structured")}
                className={`rounded px-2 py-1 ${view === "structured" ? "bg-white shadow-sm" : "text-gray-500"}`}
              >
                構造化ビュー
              </button>
              <button
                onClick={() => setView("markdown")}
                className={`rounded px-2 py-1 ${view === "markdown" ? "bg-white shadow-sm" : "text-gray-500"}`}
              >
                Markdownで見る
              </button>
            </div>
          )}
        </div>
        {!deliverable && <p className="text-sm text-gray-400">まだ確定していません。</p>}
        {deliverable && view === "markdown" && (
          <div>
            <pre className="mb-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">
              {structuredListToMarkdown(deliverable)}
            </pre>
            <button
              onClick={handleCopyMarkdown}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
        )}
        {deliverable && view === "structured" && (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-1 pr-2">ID</th>
                  <th className="py-1 pr-2">タイトル</th>
                  <th className="py-1 pr-2">説明</th>
                  <th className="py-1 pr-2">優先度</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {deliverable.items.map((item) =>
                  editingId === item.id && editDraft ? (
                    <tr key={item.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-2 font-mono text-xs text-gray-500">{item.id}</td>
                      <td className="py-2 pr-2">
                        <input
                          value={editDraft.title}
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={editDraft.description}
                          onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                          className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={editDraft.priority}
                          onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value })}
                          className="rounded border border-gray-300 px-1 py-0.5 text-sm"
                        >
                          <option value="Must">Must</option>
                          <option value="Should">Should</option>
                          <option value="Could">Could</option>
                        </select>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="mr-2 text-xs text-gray-900 underline disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                          className="text-xs text-gray-500"
                        >
                          取消
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-2 font-mono text-xs text-gray-500">{item.id}</td>
                      <td className="py-2 pr-2 font-medium text-gray-900">{item.title}</td>
                      <td className="py-2 pr-2 text-gray-600">{item.description}</td>
                      <td className="py-2 pr-2 text-gray-600">{item.priority}</td>
                      <td className="py-2 whitespace-nowrap">
                        <button onClick={() => startEdit(item)} className="mr-2 text-xs text-gray-600 hover:text-gray-900">
                          編集
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:text-red-700">
                          削除
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <button
              onClick={handleAddItem}
              className="mt-3 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              ＋ 項目を追加
            </button>
          </>
        )}
      </div>
    </div>
  );
}
