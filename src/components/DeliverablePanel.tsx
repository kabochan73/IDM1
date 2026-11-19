"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { structuredListToMarkdown, wireframeToMarkdown, erDiagramToMarkdown } from "@/lib/deliverableToMarkdown";
import { WireframeView } from "@/components/WireframeView";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import type { WireframeElement } from "@/lib/schemas/wireframe";
import type { DeliverableFormat } from "@/generated/prisma/client";

type StructuredItem = { id: string; title: string; description: string; priority: string };
type StructuredListContent = { items: StructuredItem[] };
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
type DeliverableContent = StructuredListContent | WireframeContent | ErDiagramContent;

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

  if (!deliverable) {
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
              {(deliverable as StructuredListContent).items.map((item) =>
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
                      <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-red-500 hover:text-red-700">
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
    </div>
  );
}
