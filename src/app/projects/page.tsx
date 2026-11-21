import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPhaseConfig } from "@/lib/phases";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const { userId } = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { phases: { select: { status: true, order: true, type: true }, orderBy: { order: "asc" } } },
  });

  const initialProjects = projects.map((project) => {
    const doneCount = project.phases.filter((p) => p.status === "DONE").length;
    const totalCount = project.phases.length;
    const currentPhase = project.phases.find((p) => p.status !== "DONE");

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      doneCount,
      totalCount,
      currentPhaseLabel: currentPhase
        ? `${currentPhase.status === "NEEDS_REVIEW" ? "要見直し" : "進行中"}: ${getPhaseConfig(currentPhase.type).labelJa}`
        : "全工程完了",
    };
  });

  return <ProjectsClient initialProjects={initialProjects} />;
}
