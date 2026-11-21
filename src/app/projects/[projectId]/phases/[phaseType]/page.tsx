import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadProjectWithPhases, isPhaseUnlocked, findEarliestIncompletePhase } from "@/lib/phaseGuard";
import { getPhaseConfig } from "@/lib/phases";
import type { PhaseType } from "@/generated/prisma/client";
import { PhaseChatClient } from "./PhaseChatClient";

export default async function PhasePage(props: PageProps<"/projects/[projectId]/phases/[phaseType]">) {
  const { userId } = await requireUser();
  const { projectId, phaseType } = await props.params;

  const project = await loadProjectWithPhases(projectId, userId);
  if (!project) notFound();

  const targetType = phaseType.toUpperCase() as PhaseType;
  const phase = project.phases.find((p) => p.type === targetType);
  if (!phase) notFound();

  if (!isPhaseUnlocked(project.phases, targetType)) {
    const earliest = findEarliestIncompletePhase(project.phases);
    redirect(`/projects/${projectId}/phases/${(earliest ?? phase).type.toLowerCase()}`);
  }

  const [history, deliverable] = await Promise.all([
    prisma.chatMessage.findMany({ where: { phaseId: phase.id }, orderBy: { createdAt: "asc" } }),
    prisma.deliverable.findUnique({ where: { phaseId: phase.id } }),
  ]);

  const config = getPhaseConfig(targetType);

  return (
    <div className="px-8 py-10">
      <Link href={`/projects/${projectId}`} className="mb-3 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← {project.title}
      </Link>
      <PhaseChatClient
        projectId={projectId}
        phaseType={phaseType}
        phaseLabel={config.labelJa}
        phaseStatus={phase.status}
        deliverableFormat={config.format}
        initialMessages={history.map((m) => ({ role: m.role, content: m.content }))}
        initialDeliverable={deliverable ? deliverable.content : null}
      />
    </div>
  );
}
