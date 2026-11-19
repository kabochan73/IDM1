import { NextResponse } from "next/server";
import type { PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { getPhaseConfig } from "@/lib/phases";
import { StructuredListSchema } from "@/lib/schemas/structuredList";

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/deliverable">) {
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

  const existingDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });
  if (!existingDeliverable) {
    return NextResponse.json({ error: "まだ成果物が確定していません。" }, { status: 400 });
  }

  if (getPhaseConfig(targetType).format !== "STRUCTURED_LIST") {
    return NextResponse.json({ error: "このフェーズの編集は未対応です。" }, { status: 501 });
  }

  const body = await request.json().catch(() => null);
  const parsed = StructuredListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が正しくありません。" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliverable.update({
      where: { phaseId: phase.id },
      data: { content: parsed.data, version: existingDeliverable.version + 1 },
    });

    // 直接編集も再確定と同じ扱い: 確定済み(DONE/NEEDS_REVIEW)の内容が変わった場合、
    // それより後ろで既にDONEだったフェーズ(=まだ未着手のものは対象外)をNEEDS_REVIEWにする。
    // 実装TODOチェックリスト(CHECKLISTのdone切替)はこのAPIを通らないため対象外になる。
    if (phase.status === "DONE" || phase.status === "NEEDS_REVIEW") {
      const downstreamDonePhaseIds = project.phases
        .filter((p) => p.order > phase.order && p.status === "DONE")
        .map((p) => p.id);

      if (downstreamDonePhaseIds.length > 0) {
        await tx.phase.updateMany({
          where: { id: { in: downstreamDonePhaseIds } },
          data: { status: "NEEDS_REVIEW" },
        });
      }
    }
  });

  return NextResponse.json({ ok: true, content: parsed.data });
}
