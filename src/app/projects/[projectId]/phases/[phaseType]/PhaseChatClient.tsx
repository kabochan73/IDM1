"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DeliverablePanel } from "@/components/DeliverablePanel";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/phaseStatus";
import type { PhaseStatus, DeliverableFormat } from "@/generated/prisma/client";

const FINALIZE_MARKER = "\u0000FINALIZE_READY\u0000";

type ChatMessageView = { role: "USER" | "ASSISTANT"; content: string };

function tabClass(active: boolean) {
  return `border-b-2 px-3 py-2 text-sm ${
    active ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
  }`;
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          h1: ({ children }) => <p className="mt-3 mb-1 font-semibold text-gray-900">{children}</p>,
          h2: ({ children }) => <p className="mt-3 mb-1 font-semibold text-gray-900">{children}</p>,
          h3: ({ children }) => <p className="mt-3 mb-1 font-semibold text-gray-900">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-gray-200 px-1 font-mono text-xs">{children}</code>,
          hr: () => <hr className="my-2 border-gray-200" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold text-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-gray-200 px-2 py-1 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<"chat" | "deliverable">("chat");

  const isChecklist = deliverableFormat === "CHECKLIST";

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

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-900">{phaseLabel}フェーズ</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[status as PhaseStatus]}`}>
          {STATUS_LABEL[status as PhaseStatus]}
        </span>
      </div>

      {readyToFinalize && (
        <div className="border-b border-gray-200 bg-amber-50 px-4 py-3">
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

      {status === "NEEDS_REVIEW" && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-amber-50 px-4 py-3">
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

      {!isChecklist && (
        <div className="flex gap-1 border-b border-gray-200 px-4">
          <button onClick={() => setActiveTab("chat")} className={tabClass(activeTab === "chat")}>
            チャット
          </button>
          <button onClick={() => setActiveTab("deliverable")} className={tabClass(activeTab === "deliverable")}>
            成果物
          </button>
        </div>
      )}

      {isChecklist || activeTab === "deliverable" ? (
        <div className="p-4">
          <DeliverablePanel
            projectId={projectId}
            phaseType={phaseType}
            format={deliverableFormat}
            deliverable={deliverable as Parameters<typeof DeliverablePanel>[0]["deliverable"]}
            onSaved={(content) => {
              setDeliverable(content);
              if (isChecklist) setStatus("DONE");
            }}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: "60vh" }}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "USER" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left ${
                    m.role === "USER" ? "bg-gray-900 text-sm whitespace-pre-wrap text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.role === "ASSISTANT" ? <AssistantMessage content={m.content || "…"} /> : m.content}
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-gray-400">AIとのチャットでヒアリングが始まります。</p>}
          </div>

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
        </>
      )}
    </div>
  );
}
