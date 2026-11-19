import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProjectsClient } from "./ProjectsClient";

export default async function ProjectsPage() {
  const { userId } = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { phases: { select: { status: true } } },
  });

  const initialProjects = projects.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    doneCount: project.phases.filter((p) => p.status === "DONE").length,
    totalCount: project.phases.length,
  }));

  return <ProjectsClient initialProjects={initialProjects} />;
}
