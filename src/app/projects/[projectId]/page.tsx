import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ConsistencyCheckClient } from "./ConsistencyCheckClient";

export default async function ProjectDetailPage(props: PageProps<"/projects/[projectId]">) {
  const { userId } = await requireUser();
  const { projectId } = await props.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project || project.userId !== userId) {
    notFound();
  }

  const latestCheck = await prisma.consistencyCheck.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-1 text-lg font-semibold text-gray-900">{project.title}</h1>
      <p className="mb-6 text-sm text-gray-500">フェーズの一覧・進捗はサイドバーから。ここでは成果物間の整合性を確認できます。</p>

      <ConsistencyCheckClient
        projectId={projectId}
        initialResult={latestCheck ? (latestCheck.resultJson as { findings: never[]; summary: string }) : null}
      />
    </div>
  );
}
