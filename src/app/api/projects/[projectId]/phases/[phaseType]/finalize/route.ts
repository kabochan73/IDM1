import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { PhaseType } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { buildHearingSystemPrompt, getPhaseConfig } from "@/lib/phases";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { StructuredListSchema } from "@/lib/schemas/structuredList";
import { WireframeContentSchema } from "@/lib/schemas/wireframe";
import { ErDiagramContentSchema } from "@/lib/schemas/erDiagram";
import { generateChecklistItems } from "@/lib/checklistGenerator";

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
  const config = getPhaseConfig(targetType);

  // 実装TODO(CHECKLIST)は別途対応する(チャットを経由せず自動生成するため)。
  if (config.format === "CHECKLIST") {
    return NextResponse.json({ error: "このフェーズのfinalizeは未対応です。" }, { status: 501 });
  }

  const history = await prisma.chatMessage.findMany({
    where: { phaseId: phase.id },
    orderBy: { createdAt: "asc" },
  });

  if (history.length === 0) {
    return NextResponse.json({ error: "まだヒアリングが行われていません。" }, { status: 400 });
  }

  const outputFormat =
    config.format === "WIREFRAME"
      ? zodOutputFormat(WireframeContentSchema)
      : config.format === "ER_DIAGRAM"
        ? zodOutputFormat(ErDiagramContentSchema)
        : zodOutputFormat(StructuredListSchema);

  const message = await anthropic.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: buildHearingSystemPrompt(targetType),
    output_config: { format: outputFormat },
    messages: [
      ...history.map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: "これまでのやり取りを踏まえて、このフェーズの最終的な成果物を作成してください。" },
    ],
  });

  let content: Prisma.InputJsonValue | undefined = message.parsed_output as Prisma.InputJsonValue | undefined;
  if (!content) {
    return NextResponse.json({ error: "成果物の生成に失敗しました。" }, { status: 502 });
  }

  const existingDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });

  // WIREFRAMEの再確定では、デザインイメージ(designImages)はテキストヒアリングとは別管理のため、
  // 既存のものをそのまま引き継ぐ(再確定で消えないようにする)。
  if (config.format === "WIREFRAME" && existingDeliverable) {
    const existingContent = existingDeliverable.content as { designImages?: unknown };
    if (existingContent.designImages) {
      content = { ...(content as object), designImages: existingContent.designImages };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliverable.upsert({
      where: { phaseId: phase.id },
      update: { content, version: (existingDeliverable?.version ?? 0) + 1, isFinal: true },
      create: { phaseId: phase.id, format: config.format, content, version: 1, isFinal: true },
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

  // テスト設計の確定直後に、実装TODOチェックリストをチャットなしで自動生成する(FUNC-030)。
  // ここで失敗しても、既に確定済みのテスト設計自体は成功として扱う(生成は後からでも「生成する」ボタンでリトライできる)。
  if (targetType === "TEST_DESIGN") {
    try {
      const checklistPhase = project.phases.find((p) => p.type === "IMPLEMENTATION_CHECKLIST");
      if (checklistPhase) {
        const generatedItems = await generateChecklistItems(projectId);
        const checklistContent: Prisma.InputJsonValue = {
          items: generatedItems.map((item) => ({ ...item, done: false })),
        };
        await prisma.deliverable.upsert({
          where: { phaseId: checklistPhase.id },
          update: { content: checklistContent, version: { increment: 1 } },
          create: { phaseId: checklistPhase.id, format: "CHECKLIST", content: checklistContent, version: 1, isFinal: true },
        });
        await prisma.phase.update({ where: { id: checklistPhase.id }, data: { status: "DONE" } });
      }
    } catch (error) {
      console.error("checklist auto-generation failed:", error);
    }
  }

  return NextResponse.json({ ok: true, content });
}
