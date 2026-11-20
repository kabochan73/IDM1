import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PhaseStepper } from "@/components/PhaseStepper";

export default async function ProjectDetailPage(props: PageProps<"/projects/[projectId]">) {
  const { userId } = await requireUser();
  const { projectId } = await props.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  if (!project || project.userId !== userId) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{project.title}</h1>
        <Link href={`/projects/${projectId}/progress`} className="text-sm text-brand-600 hover:text-brand-700">
          進捗ダッシュボード →
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">フェーズをクリックして進めてください。</p>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <PhaseStepper projectId={projectId} phases={project.phases} />
      </div>
    </div>
  );
}
