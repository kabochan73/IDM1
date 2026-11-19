import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { buildHearingSystemPrompt } from "@/lib/phases";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { StructuredListSchema } from "@/lib/schemas/structuredList";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/finalize">,
) {
  const { userId } = await requireUser();
  const { projectId, phaseType } = await ctx.params;

  const project = await loadProjectWithPhases(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  const targetType = phaseType.toUpperCase() as PhaseType;
  if (!isPhaseUnlocked(project.phases, targetType)) {
    return NextResponse.json({ error: "このフェーズはまだ開始できません。" }, { status: 403 });
  }

  const phase = project.phases.find((p) => p.type === targetType)!;

  // M1時点ではSTRUCTURED_LIST形式のフェーズ(企画・要件定義・機能設計・詳細設計・テスト設計)のみ対応
  if (targetType !== "PLANNING") {
    return NextResponse.json({ error: "このフェーズのfinalizeは未対応です。" }, { status: 501 });
  }

  const history = await prisma.chatMessage.findMany({
    where: { phaseId: phase.id },
    orderBy: { createdAt: "asc" },
  });

  if (history.length === 0) {
    return NextResponse.json({ error: "まだヒアリングが行われていません。" }, { status: 400 });
  }

  const message = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: buildHearingSystemPrompt(targetType),
    output_config: { format: zodOutputFormat(StructuredListSchema) },
    messages: [
      ...history.map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: "これまでのやり取りを踏まえて、このフェーズの最終的な成果物を作成してください。" },
    ],
  });

  const content = message.parsed_output;
  if (!content) {
    return NextResponse.json({ error: "成果物の生成に失敗しました。" }, { status: 502 });
  }

  const existingDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });

  await prisma.$transaction(async (tx) => {
    await tx.deliverable.upsert({
      where: { phaseId: phase.id },
      update: { content, version: (existingDeliverable?.version ?? 0) + 1, isFinal: true },
      create: { phaseId: phase.id, format: "STRUCTURED_LIST", content, version: 1, isFinal: true },
    });

    await tx.phase.update({ where: { id: phase.id }, data: { status: "DONE" } });

    const nextPhase = project.phases.find((p) => p.order === phase.order + 1);
    if (nextPhase && nextPhase.status === "NOT_STARTED") {
      await tx.phase.update({ where: { id: nextPhase.id }, data: { status: "IN_PROGRESS" } });
    }

    const downstreamDonePhaseIds = project.phases
      .filter((p) => p.order > phase.order && p.status === "DONE")
      .map((p) => p.id);

    if (downstreamDonePhaseIds.length > 0) {
      await tx.phase.updateMany({
        where: { id: { in: downstreamDonePhaseIds } },
        data: { status: "NEEDS_REVIEW" },
      });
    }
  });

  return NextResponse.json({ ok: true, content });
}
