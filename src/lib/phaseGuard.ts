import "server-only";
import type { Phase, PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function loadProjectWithPhases(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  if (!project || project.userId !== userId) {
    return null;
  }

  return project;
}

/** ステータスがDONEまたはNEEDS_REVIEWなら「到達済み」とみなす(進行自体はブロックしない)。 */
function isReached(status: Phase["status"]): boolean {
  return status === "DONE" || status === "NEEDS_REVIEW";
}

export function isPhaseUnlocked(phases: Phase[], targetType: PhaseType): boolean {
  const target = phases.find((p) => p.type === targetType);
  if (!target) return false;
  return phases.every((p) => p.order >= target.order || isReached(p.status));
}

/** 一番手前の未完了フェーズ(リダイレクト先)。全部完了していればnull。 */
export function findEarliestIncompletePhase(phases: Phase[]): Phase | null {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  return sorted.find((p) => !isReached(p.status)) ?? null;
}
