import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases } from "@/lib/phaseGuard";
import { generateChecklistItems, mergeChecklist } from "@/lib/checklistGenerator";
import type { ChecklistContent } from "@/lib/schemas/checklist";

const RequestSchema = z.object({ regenerate: z.boolean().optional() });

/**
 * 「要見直し」フェーズを確認して解消する(FUNC-042)。
 * 通常は「問題なし」でDONEに戻すだけ。実装TODOチェックリストのみ、regenerate:trueで
 * 再生成(既存のチェック済み状態はID一致で引き継ぐ)も選べる。
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/resolve-review">,
) {
  const { userId } = await requireUser();
  const { projectId, phaseType } = await ctx.params;

  const project = await loadProjectWithPhases(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  const targetType = phaseType.toUpperCase() as PhaseType;
  const phase = project.phases.find((p) => p.type === targetType);
  if (!phase) {
    return NextResponse.json({ error: "フェーズが見つかりません。" }, { status: 404 });
  }

  if (phase.status !== "NEEDS_REVIEW") {
    return NextResponse.json({ error: "このフェーズは要見直し状態ではありません。" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  const regenerate = parsed.success && parsed.data.regenerate === true && targetType === "IMPLEMENTATION_CHECKLIST";

  let content: Prisma.InputJsonValue | undefined;

  if (regenerate) {
    const existingDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });
    const existingItems = (existingDeliverable?.content as ChecklistContent | undefined)?.items ?? [];

    const generatedItems = await generateChecklistItems(projectId);
    const mergedItems = mergeChecklist(existingItems, generatedItems);
    content = { items: mergedItems };

    await prisma.deliverable.update({
      where: { phaseId: phase.id },
      data: { content, version: (existingDeliverable?.version ?? 0) + 1 },
    });
  }

  await prisma.phase.update({ where: { id: phase.id }, data: { status: "DONE" } });

  return NextResponse.json({ ok: true, content });
}
