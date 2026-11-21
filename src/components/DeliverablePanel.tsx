"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  structuredListToMarkdown,
  wireframeToMarkdown,
  erDiagramToMarkdown,
  checklistToMarkdown,
} from "@/lib/deliverableToMarkdown";
import { WireframeView } from "@/components/WireframeView";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { WireframeElement } from "@/lib/schemas/wireframe";
import type { DeliverableFormat } from "@/generated/prisma/client";

type StructuredItem = { id: string; title: string; description: string; priority: string; relatedIds?: string[] };
type StructuredListContent = { items: StructuredItem[] };

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  Must: "bg-red-50 text-red-700",
  Should: "bg-amber-50 text-amber-700",
  Could: "bg-gray-100 text-gray-600",
};
type DesignImage = { screenName: string; imageBase64: string; prompt: string };
type WireframeContent = {
  screens: { name: string; elements: WireframeElement[] }[];
  transitionsMermaid: string;
  designImages?: DesignImage[];
};
type ErDiagramContent = {
  mermaid: string;
  entities: { name: string; fields: { name: string; type: string; isPK: boolean; isFK: boolean }[] }[];
};
type ChecklistItem = { id: string; label: string; relatedFunctionalItem?: string; done: boolean };
type ChecklistContent = { items: ChecklistItem[] };
type DeliverableContent = StructuredListContent | WireframeContent | ErDiagramContent | ChecklistContent;

export function DeliverablePanel({
  projectId,
  phaseType,
  format,
  deliverable,
  onSaved,
}: {
  projectId: string;
  phaseType: string;
  format: DeliverableFormat;
  deliverable: DeliverableContent | null;
  onSaved: (content: DeliverableContent) => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<"structured" | "markdown">("structured");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // STRUCTURED_LIST editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StructuredItem | null>(null);

  // WIREFRAME transition diagram editing state
  const [editingMermaid, setEditingMermaid] = useState(false);
  const [mermaidDraft, setMermaidDraft] = useState("");

  // WIREFRAME screen tab + design image generation state
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [designFeedback, setDesignFeedback] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);

  // CHECKLIST generation state (未生成/リトライ用)
  const [generatingChecklist, setGeneratingChecklist] = useState(false);

  async function patch(content: DeliverableContent) {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/deliverable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setSaving(false);

    if (!res.ok) {
      alert("保存に失敗しました。");
      return;
    }

    onSaved(content);
    router.refresh();
  }

  function markdown(): string {
    if (!deliverable) return "";
    if (format === "STRUCTURED_LIST") return structuredListToMarkdown(deliverable as StructuredListContent);
    if (format === "WIREFRAME") return wireframeToMarkdown(deliverable as WireframeContent);
    if (format === "ER_DIAGRAM") return erDiagramToMarkdown(deliverable as ErDiagramContent);
    if (format === "CHECKLIST") return checklistToMarkdown(deliverable as ChecklistContent);
    return "";
  }

  async function handleCopyMarkdown() {
    await navigator.clipboard.writeText(markdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // --- STRUCTURED_LIST handlers ---
  function startEdit(item: StructuredItem) {
    setEditingId(item.id);
    setEditDraft({ ...item });
  }

  function handleSaveEdit() {
    const content = deliverable as StructuredListContent;
    if (!content || !editDraft) return;
    const items = content.items.map((i) => (i.id === editDraft.id ? editDraft : i));
    setEditingId(null);
    setEditDraft(null);
    patch({ items });
  }

  function handleDeleteItem(id: string) {
    const content = deliverable as StructuredListContent;
    if (!content) return;
    if (!confirm("この項目を削除しますか？")) return;
    patch({ items: content.items.filter((i) => i.id !== id) });
  }

  function handleAddItem() {
    const content = deliverable as StructuredListContent;
    if (!content) return;
    const newItem: StructuredItem = { id: `NEW-${Date.now()}`, title: "", description: "", priority: "Must" };
    startEdit(newItem);
    onSaved({ items: [...content.items, newItem] });
  }

  // --- WIREFRAME(画面遷移図)/ER_DIAGRAM 共通のMermaid編集ハンドラ ---
  function startEditMermaid() {
    if (format === "WIREFRAME") {
      setMermaidDraft((deliverable as WireframeContent)?.transitionsMermaid ?? "");
    } else if (format === "ER_DIAGRAM") {
      setMermaidDraft((deliverable as ErDiagramContent)?.mermaid ?? "");
    }
    setEditingMermaid(true);
  }

  function handleSaveMermaid() {
    if (!deliverable) return;
    if (format === "WIREFRAME") {
      patch({ ...(deliverable as WireframeContent), transitionsMermaid: mermaidDraft });
    } else if (format === "ER_DIAGRAM") {
      patch({ ...(deliverable as ErDiagramContent), mermaid: mermaidDraft });
    }
    setEditingMermaid(false);
  }

  async function handleGenerateImage() {
    const content = deliverable as WireframeContent;
    const screen = content.screens[activeScreenIndex];
    if (!screen) return;

    setGeneratingImage(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/design-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenName: screen.name, feedback: designFeedback || undefined }),
    });
    setGeneratingImage(false);

    if (!res.ok) {
      alert("画像生成に失敗しました。");
      return;
    }

    const data = await res.json();
    setDesignFeedback("");
    onSaved({ ...content, designImages: data.designImages });
  }

  // --- CHECKLIST handlers ---
  function handleToggleDone(id: string) {
    const content = deliverable as ChecklistContent;
    if (!content) return;
    patch({ items: content.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) });
  }

  async function handleGenerateChecklist() {
    setGeneratingChecklist(true);
    const res = await fetch(`/api/projects/${projectId}/phases/${phaseType}/generate-checklist`, { method: "POST" });
    setGeneratingChecklist(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "生成に失敗しました。");
      return;
    }

    const data = await res.json();
    onSaved(data.content);
    router.refresh();
  }

  if (!deliverable) {
    if (format === "CHECKLIST") {
      return (
        <div>
          <p className="mb-2 text-sm text-gray-400">まだ生成されていません。</p>
          <button
            onClick={handleGenerateChecklist}
            disabled={generatingChecklist}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generatingChecklist ? "生成中..." : "生成する"}
          </button>
        </div>
      );
    }
    return <p className="text-sm text-gray-400">まだ確定していません。</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
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
      </div>

      {view === "markdown" && (
        <div>
          <pre className="mb-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">
            {markdown()}
          </pre>
          <button
            onClick={handleCopyMarkdown}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
      )}

      {view === "structured" && format === "STRUCTURED_LIST" && (
        <>
          <ul className="space-y-2">
            {(deliverable as StructuredListContent).items.map((item) =>
              editingId === item.id && editDraft ? (
                <li key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-400">{item.id}</span>
                    <select
                      value={editDraft.priority}
                      onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value })}
                      className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                    >
                      <option value="Must">Must</option>
                      <option value="Should">Should</option>
                      <option value="Could">Could</option>
                    </select>
                  </div>
                  <input
                    value={editDraft.title}
                    onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                    placeholder="タイトル"
                    className="mb-1.5 w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                    placeholder="説明"
                    rows={2}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <div className="mt-2 flex justify-end gap-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      取消
                    </button>
                  </div>
                </li>
              ) : (
                <li key={item.id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-400">{item.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_BADGE_CLASS[item.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{item.description}</p>
                  {item.relatedIds && item.relatedIds.length > 0 && (
                    <p className="mt-2 text-xs text-gray-400">関連: {item.relatedIds.join(", ")}</p>
                  )}
                  <div className="mt-2 flex justify-end gap-3">
                    <button onClick={() => startEdit(item)} className="text-xs text-gray-600 hover:text-gray-900">
                      編集
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-red-500 hover:text-red-700">
                      削除
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
          <button
            onClick={handleAddItem}
            className="mt-3 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            ＋ 項目を追加
          </button>
        </>
      )}

      {view === "structured" && format === "WIREFRAME" && (
        <div className="space-y-4">
          <WireframeView
            screens={(deliverable as WireframeContent).screens}
            activeIndex={activeScreenIndex}
            onActiveIndexChange={setActiveScreenIndex}
          />
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500">デザインイメージ(参考画像・任意)</h3>
            {(() => {
              const content = deliverable as WireframeContent;
              const screen = content.screens[activeScreenIndex];
              const image = content.designImages?.find((img) => img.screenName === screen?.name);
              return (
                <div className="space-y-2">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${image.imageBase64}`}
                      alt={`${screen?.name}のデザインイメージ`}
                      className="max-w-xs rounded-md border border-gray-200"
                    />
                  ) : (
                    <p className="text-xs text-gray-400">まだ生成していません。</p>
                  )}
                  <input
                    value={designFeedback}
                    onChange={(e) => setDesignFeedback(e.target.value)}
                    placeholder="見た目の要望(例: もっと明るい雰囲気で)"
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {generatingImage ? "生成中..." : image ? "ブラッシュアップ" : "生成する"}
                  </button>
                </div>
              );
            })()}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500">画面遷移図</h3>
            {editingMermaid ? (
              <div>
                <textarea
                  value={mermaidDraft}
                  onChange={(e) => setMermaidDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleSaveMermaid}
                    disabled={saving}
                    className="rounded-md bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-50"
                  >
                    再レンダリング
                  </button>
                  <button
                    onClick={() => setEditingMermaid(false)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <MermaidDiagram source={(deliverable as WireframeContent).transitionsMermaid} />
                <button onClick={startEditMermaid} className="mt-2 text-xs text-gray-600 underline hover:text-gray-900">
                  Mermaidソースを編集
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "structured" && format === "ER_DIAGRAM" && (
        <div className="space-y-4">
          {editingMermaid ? (
            <div>
              <textarea
                value={mermaidDraft}
                onChange={(e) => setMermaidDraft(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSaveMermaid}
                  disabled={saving}
                  className="rounded-md bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  再レンダリング
                </button>
                <button
                  onClick={() => setEditingMermaid(false)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div>
              <MermaidDiagram source={(deliverable as ErDiagramContent).mermaid} />
              <button onClick={startEditMermaid} className="mt-2 text-xs text-gray-600 underline hover:text-gray-900">
                Mermaidソースを編集
              </button>
            </div>
          )}
          <div className="space-y-3">
            {(deliverable as ErDiagramContent).entities.map((entity) => (
              <div key={entity.name}>
                <h4 className="mb-1 text-xs font-semibold text-gray-700">{entity.name}</h4>
                <table className="w-full text-left text-xs">
                  <tbody>
                    {entity.fields.map((field) => (
                      <tr key={field.name} className="border-b border-gray-100">
                        <td className="py-1 pr-2 font-mono text-gray-600">{field.name}</td>
                        <td className="py-1 pr-2 text-gray-500">{field.type}</td>
                        <td className="py-1 text-gray-500">
                          {[field.isPK && "PK", field.isFK && "FK"].filter(Boolean).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "structured" && format === "CHECKLIST" && (
        <ul className="space-y-2">
          {(deliverable as ChecklistContent).items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-md border border-gray-100 px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleToggleDone(item.id)}
                disabled={saving}
                className="mt-0.5"
              />
              <div>
                <span className={item.done ? "text-gray-400 line-through" : "text-gray-900"}>{item.label}</span>
                {item.relatedFunctionalItem && (
                  <span className="ml-2 font-mono text-xs text-gray-400">{item.relatedFunctionalItem}</span>
                )}
              </div>
            </li>
          ))}
          {(deliverable as ChecklistContent).items.length === 0 && (
            <p className="text-sm text-gray-400">TODO項目がありません。</p>
          )}
        </ul>
      )}
    </div>
  );
}
