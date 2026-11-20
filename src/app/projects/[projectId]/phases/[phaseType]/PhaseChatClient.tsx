"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DeliverablePanel } from "@/components/DeliverablePanel";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/phaseStatus";
import type { PhaseStatus, DeliverableFormat } from "@/generated/prisma/client";

const FINALIZE_MARKER = "\u0000FINALIZE_READY\u0000";

type ChatMessageView = { role: "USER" | "ASSISTANT"; content: string };

export function PhaseChatClient({
  projectId,
  phaseType,
  phaseLabel,
  phaseStatus,
  deliverableFormat,
  initialMessages,
  initialDeliverable,
}: {
  projectId: string;
  phaseType: string;
  phaseLabel: string;
  phaseStatus: string;
  deliverableFormat: DeliverableFormat;
  initialMessages: ChatMessageView[];
  initialDeliverable: unknown;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [readyToFinalize, setReadyToFinalize] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [deliverable, setDeliverable] = useState(initialDeliverable);
  const [status, setStatus] = useState(phaseStatus);
  const [reopened, setReopened] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function handleResolveReview(regenerate = false) {
    setResolving(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/resolve-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate }),
    });
    setResolving(false);
    if (!res.ok) {
      alert("操作に失敗しました。");
      return;
    }
    const data = await res.json();
    if (data.content) setDeliverable(data.content);
    setStatus("DONE");
    setReopened(false);
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
    setReopened(false);
    router.refresh();
  }

  const isChecklist = deliverableFormat === "CHECKLIST";

  return (
    <div className={isChecklist ? "" : "grid grid-cols-1 md:grid-cols-2"}>
      {!isChecklist && (
        <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h1 className="text-sm font-semibold text-gray-900">{phaseLabel}フェーズ</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[status as PhaseStatus]}`}>
              {STATUS_LABEL[status as PhaseStatus]}
            </span>
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

          {(status === "DONE" || status === "NEEDS_REVIEW") && !reopened ? (
            <div className="flex items-center justify-between border-t border-gray-200 p-4">
              <span className="text-sm text-gray-500">このフェーズは確定済みです</span>
              <button
                onClick={() => setReopened(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                まだ続ける
              </button>
            </div>
          ) : (
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
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {isChecklist && (
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-gray-900">{phaseLabel}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[status as PhaseStatus]}`}>
              {STATUS_LABEL[status as PhaseStatus]}
            </span>
          </div>
        )}
        {status === "NEEDS_REVIEW" && (
          <div className="mb-3 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
            <p className="text-sm text-amber-800">上流フェーズが変更されました。内容を確認してください。</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleResolveReview(false)}
                disabled={resolving}
                className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {resolving ? "処理中..." : "問題なし"}
              </button>
              {isChecklist && (
                <button
                  onClick={() => handleResolveReview(true)}
                  disabled={resolving}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {resolving ? "処理中..." : "再生成(チェック済みは維持)"}
                </button>
              )}
            </div>
          </div>
        )}
        {!isChecklist && <h2 className="mb-3 text-sm font-semibold text-gray-900">成果物</h2>}
        <DeliverablePanel
          projectId={projectId}
          phaseType={phaseType}
          format={deliverableFormat}
          deliverable={deliverable as Parameters<typeof DeliverablePanel>[0]["deliverable"]}
          onSaved={(content) => setDeliverable(content)}
        />
      </div>
    </div>
  );
}
