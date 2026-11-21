import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** サイドバーのプロジェクトモード表示用に、プロジェクトとフェーズ一覧を返す。 */
export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  const { userId } = await requireUser();
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { phases: { orderBy: { order: "asc" }, select: { id: true, type: true, order: true, status: true } } },
  });

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  return NextResponse.json({ project: { id: project.id, title: project.title, phases: project.phases } });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  const { userId } = await requireUser();
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: projectId } });

  return NextResponse.json({ ok: true });
}
