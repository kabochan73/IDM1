import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PHASE_ORDER } from "@/lib/phases";

export async function GET() {
  const { userId } = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { phases: { select: { status: true } } },
  });

  const result = projects.map((project) => {
    const doneCount = project.phases.filter((p) => p.status === "DONE").length;
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      createdAt: project.createdAt,
      doneCount,
      totalCount: project.phases.length,
    };
  });

  return NextResponse.json({ projects: result });
}

const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const { userId } = await requireUser();

  const body = await request.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "タイトルを入力してください。" }, { status: 400 });
  }

  const { title, description } = parsed.data;

  const project = await prisma.project.create({
    data: {
      userId,
      title,
      description,
      phases: {
        create: PHASE_ORDER.map((p) => ({
          type: p.type,
          order: p.order,
          status: p.order === 1 ? "IN_PROGRESS" : "NOT_STARTED",
        })),
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
