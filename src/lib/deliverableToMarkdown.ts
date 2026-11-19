type StructuredListContent = {
  items: { id: string; title: string; description: string; priority: string; relatedIds?: string[] }[];
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
