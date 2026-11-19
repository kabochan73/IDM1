"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
    router.refresh();
  }

  const isDone = phaseStatus === "DONE";

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2">
      <div className="flex flex-col rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-4 py-3">
          <h1 className="text-sm font-semibold text-gray-900">{phaseLabel}フェーズ</h1>
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
            disabled={sending || isDone}
            placeholder={isDone ? "このフェーズは確定済みです" : "メッセージを入力"}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={sending || isDone}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">成果物</h2>
        {!deliverable && <p className="text-sm text-gray-400">まだ確定していません。</p>}
        {deliverable && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="py-1 pr-2">ID</th>
                <th className="py-1 pr-2">タイトル</th>
                <th className="py-1 pr-2">説明</th>
                <th className="py-1">優先度</th>
              </tr>
            </thead>
            <tbody>
              {deliverable.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2 font-mono text-xs text-gray-500">{item.id}</td>
                  <td className="py-2 pr-2 font-medium text-gray-900">{item.title}</td>
                  <td className="py-2 pr-2 text-gray-600">{item.description}</td>
                  <td className="py-2 text-gray-600">{item.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
