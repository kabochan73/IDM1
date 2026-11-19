import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPhaseConfig } from "@/lib/phases";

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

  const statusLabel: Record<string, string> = {
    NOT_STARTED: "未着手",
    IN_PROGRESS: "進行中",
    DONE: "完了",
    NEEDS_REVIEW: "要見直し",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">{project.title}</h1>
      <p className="mb-6 text-sm text-gray-500">各フェーズのチャット画面はまもなく実装予定です。</p>

      <ol className="space-y-2">
        {project.phases.map((phase) => {
          const config = getPhaseConfig(phase.type);
          return (
            <li
              key={phase.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-2"
            >
              <span className="text-sm text-gray-900">
                {config.order}. {config.labelJa}
              </span>
              <span className="text-xs text-gray-500">{statusLabel[phase.status]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
