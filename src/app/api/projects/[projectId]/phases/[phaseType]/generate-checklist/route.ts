import { NextResponse } from "next/server";
import type { PhaseType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { getPhaseConfig } from "@/lib/phases";
import { generateChecklistItems } from "@/lib/checklistGenerator";

/**
 * 実装TODOチェックリストを手動で生成する。通常はテスト設計の確定時に自動生成されるが、
 * それより前に確定済みだったプロジェクトや、生成に失敗した場合の手動リトライ手段として使う。
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/generate-checklist">,
) {
  const { userId } = await requireUser();
  const { projectId, phaseType } = await ctx.params;

  const project = await loadProjectWithPhases(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  const targetType = phaseType.toUpperCase() as PhaseType;
  if (getPhaseConfig(targetType).format !== "CHECKLIST") {
    return NextResponse.json({ error: "このフェーズでは使えません。" }, { status: 501 });
  }

  if (!isPhaseUnlocked(project.phases, targetType)) {
    return NextResponse.json({ error: "まだテスト設計が完了していません。" }, { status: 403 });
  }

  const phase = project.phases.find((p) => p.type === targetType)!;

  const generatedItems = await generateChecklistItems(projectId);
  const content: Prisma.InputJsonValue = { items: generatedItems.map((item) => ({ ...item, done: false })) };

  const existingDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });

  await prisma.deliverable.upsert({
    where: { phaseId: phase.id },
    update: { content, version: (existingDeliverable?.version ?? 0) + 1 },
    create: { phaseId: phase.id, format: "CHECKLIST", content, version: 1, isFinal: true },
  });
  await prisma.phase.update({ where: { id: phase.id }, data: { status: "DONE" } });

  return NextResponse.json({ ok: true, content });
}
