import type { WireframeElement } from "@/lib/schemas/wireframe";

type StructuredListContent = {
  items: { id: string; title: string; description: string; priority: string; relatedIds?: string[] }[];
};

type WireframeContent = {
  screens: { name: string; elements: WireframeElement[] }[];
  transitionsMermaid: string;
};

/**
 * 構造化リストをMarkdownに変換する。表示・コピー用、および将来的には前フェーズ文脈の
 * AIへの引き渡しや整合性チェックのテキスト化でも同じ関数を使う想定(06_詳細設計.md)。
 */
export function structuredListToMarkdown(content: StructuredListContent): string {
  const lines = content.items.map((item) => {
    const related = item.relatedIds && item.relatedIds.length > 0 ? ` (関連: ${item.relatedIds.join(", ")})` : "";
    return `- **[${item.id}] ${item.title}**(${item.priority}): ${item.description}${related}`;
  });
  return lines.join("\n");
}

function elementToMarkdown(element: WireframeElement): string {
  const line = `- [${element.type}] ${element.label}`;
  const children = element.children.map((child) => `  - [${child.type}] ${child.label}`);
  return [line, ...children].join("\n");
}

/** 1画面分の要素構成をテキスト化する(画像生成プロンプトへの合成に使う)。 */
export function screenElementsToText(elements: WireframeElement[]): string {
  return elements.map((el) => elementToMarkdown(el)).join("\n");
}

/** ワイヤーフレーム(画面構成+画面遷移図)をMarkdownに変換する。 */
export function wireframeToMarkdown(content: WireframeContent): string {
  const screenParts = content.screens.map((screen) => {
    const lines = screen.elements.map((el) => elementToMarkdown(el));
    return `### ${screen.name}\n${lines.join("\n")}`;
  });

  return [...screenParts, "### 画面遷移図", "```mermaid", content.transitionsMermaid, "```"].join("\n\n");
}
