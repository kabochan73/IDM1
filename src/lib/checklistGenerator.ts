import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { structuredListToMarkdown } from "@/lib/deliverableToMarkdown";
import { ChecklistGenerationSchema, type ChecklistItem } from "@/lib/schemas/checklist";

type GeneratedItem = { id: string; label: string; relatedFunctionalItem?: string };

/** 機能設計・詳細設計・テスト設計の確定済み内容から、実装TODO項目の候補を生成する(FUNC-030)。 */
export async function generateChecklistItems(projectId: string): Promise<GeneratedItem[]> {
  const phases = await prisma.phase.findMany({
    where: { projectId, type: { in: ["FUNCTIONAL_DESIGN", "DETAILED_DESIGN", "TEST_DESIGN"] } },
    include: { deliverable: true },
  });

  const sections = phases
    .filter((p) => p.deliverable)
    .map((p) => `## ${p.type}\n${structuredListToMarkdown(p.deliverable!.content as never)}`);

  if (sections.length === 0) return [];

  const message = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      "あなたはWeb開発の実装TODOリストを作る担当者です。機能設計・詳細設計・テスト設計の内容から、実装すべきタスクを機能設計の項目ごとに1つ以上のTODOとして洗い出してください。コードは書かず、タスクの一覧だけを作ってください。",
    output_config: { format: zodOutputFormat(ChecklistGenerationSchema) },
    messages: [
      {
        role: "user",
        content: `以下の設計内容から実装TODOリストを作ってください。\n\n${sections.join("\n\n")}`,
      },
    ],
  });

  return message.parsed_output?.items ?? [];
}

/**
 * 再生成時に、既存のチェック済み(done)状態をrelatedFunctionalItem(+label)で突き合わせて引き継ぐ(FUNC-042)。
 * 同じ既存項目を複数の新項目に重複して割り当てないよう、一度使った既存項目は除外する。
 */
export function mergeChecklist(existingItems: ChecklistItem[], newItems: GeneratedItem[]): ChecklistItem[] {
  const usedExistingIds = new Set<string>();

  return newItems.map((item) => {
    let match = existingItems.find(
      (e) =>
        !usedExistingIds.has(e.id) && e.relatedFunctionalItem === item.relatedFunctionalItem && e.label === item.label,
    );
    if (!match) {
      match = existingItems.find((e) => !usedExistingIds.has(e.id) && e.relatedFunctionalItem === item.relatedFunctionalItem);
    }
    if (match) usedExistingIds.add(match.id);

    return { ...item, done: match?.done ?? false };
  });
}
