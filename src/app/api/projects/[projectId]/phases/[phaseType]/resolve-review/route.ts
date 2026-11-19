import { NextResponse } from "next/server";
import type { PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases } from "@/lib/phaseGuard";

/** 「要見直し」フェーズを確認し、問題なしとしてDONEに戻す(FUNC-042)。 */
export async function POST(
  _request: Request,
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

  await prisma.phase.update({ where: { id: phase.id }, data: { status: "DONE" } });

  return NextResponse.json({ ok: true });
}
