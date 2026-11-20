import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getPhaseConfig } from "@/lib/phases";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { ConsistencyCheckResultSchema } from "@/lib/schemas/consistencyCheck";
import { structuredListToMarkdown, wireframeToMarkdown, erDiagramToMarkdown } from "@/lib/deliverableToMarkdown";

function deliverableToText(format: string, content: unknown): string {
  try {
    if (format === "STRUCTURED_LIST") return structuredListToMarkdown(content as never);
    if (format === "WIREFRAME") return wireframeToMarkdown(content as never);
    if (format === "ER_DIAGRAM") return erDiagramToMarkdown(content as never);
  } catch {
    // 形式不一致などで変換に失敗した場合は空文字にフォールバックする
  }
  return "";
}

export async function POST(_request: Request, ctx: RouteContext<"/api/projects/[projectId]/consistency-check">) {
  const { userId } = await requireUser();
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      phases: {
        where: { status: "DONE" },
        orderBy: { order: "asc" },
        include: { deliverable: true },
      },
    },
  });

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  const donePhasesWithDeliverable = project.phases.filter((p) => p.deliverable);
  if (donePhasesWithDeliverable.length === 0) {
    return NextResponse.json({ error: "まだ確定済みのフェーズがありません。" }, { status: 400 });
  }

  const sections = donePhasesWithDeliverable.map((phase) => {
    const label = getPhaseConfig(phase.type).labelJa;
    const text = deliverableToText(phase.deliverable!.format, phase.deliverable!.content);
    return `## ${label}\n${text}`;
  });

  const message = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      "あなたはWeb開発の設計レビュアーです。確定済みの各フェーズの設計ドキュメントを読み、工程間の矛盾や抜け漏れ(例: 要件定義にある機能がDB設計のテーブルに反映されていない等)を指摘してください。矛盾がなければfindingsは空配列にしてください。",
    output_config: { effort: "high", format: zodOutputFormat(ConsistencyCheckResultSchema) },
    messages: [
      {
        role: "user",
        content: `以下は確定済みの設計ドキュメントです。工程をまたいだ矛盾・懸念点を指摘してください。\n\n${sections.join("\n\n")}`,
      },
    ],
  });

  const result = message.parsed_output;
  if (!result) {
    return NextResponse.json({ error: "整合性チェックに失敗しました。" }, { status: 502 });
  }

  await prisma.consistencyCheck.create({
    data: { projectId, resultJson: result },
  });

  return NextResponse.json({ ok: true, result });
}
