import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPhaseConfig } from "@/lib/phases";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/phaseStatus";
import { ConsistencyCheckClient } from "./ConsistencyCheckClient";

export default async function ProgressPage(props: PageProps<"/projects/[projectId]/progress">) {
  const { userId } = await requireUser();
  const { projectId } = await props.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  if (!project || project.userId !== userId) {
    notFound();
  }

  const latestCheck = await prisma.consistencyCheck.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link href={`/projects/${projectId}`} className="mb-3 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← {project.title}
      </Link>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">進捗状況</h1>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="py-1 pr-2">フェーズ</th>
              <th className="py-1 pr-2">ステータス</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {project.phases.map((phase) => {
              const config = getPhaseConfig(phase.type);
              const reachable = phase.status !== "NOT_STARTED";
              return (
                <tr key={phase.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2 text-gray-900">
                    {config.order}. {config.labelJa}
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[phase.status]}`}>
                      {STATUS_LABEL[phase.status]}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {reachable && (
                      <Link
                        href={`/projects/${projectId}/phases/${phase.type.toLowerCase()}`}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        開く
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConsistencyCheckClient
        projectId={projectId}
        initialResult={latestCheck ? (latestCheck.resultJson as { findings: never[]; summary: string }) : null}
      />
    </div>
  );
}
