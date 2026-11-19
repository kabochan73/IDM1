import { NextResponse } from "next/server";
import { z } from "zod";
import type { PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { buildHearingSystemPrompt } from "@/lib/phases";
import { anthropic, CLAUDE_MODEL, PROPOSE_FINALIZE_TOOL } from "@/lib/claude";

const ChatRequestSchema = z.object({ message: z.string().min(1).max(4000) });

/** 確定準備ができたことをクライアントに伝えるためのストリーム末尾マーカー。通常の会話テキストには出現しない前提。 */
const FINALIZE_MARKER = "\u0000FINALIZE_READY\u0000";

function buildPriorContext(
  phases: { type: PhaseType; order: number; deliverable: { content: unknown } | null }[],
  currentOrder: number,
): string {
  const prior = phases.filter((p) => p.order < currentOrder && p.deliverable);
  if (prior.length === 0) return "";

  const parts = prior.map((p) => {
    const content = p.deliverable!.content as { items?: { id: string; title: string; description: string }[] };
    const lines = (content.items ?? []).map((item) => `  - [${item.id}] ${item.title}: ${item.description}`);
    // WIREFRAME/ER_DIAGRAM/CHECKLIST等、items配列を持たない形式は未対応のためプレースホルダーのみ記載する。
    return `## ${p.type}\n${lines.length > 0 ? lines.join("\n") : "  (このフェーズは確定済みです)"}`;
  });

  return `これまでに確定した前フェーズの内容:\n${parts.join("\n\n")}`;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/chat">,
) {
  const { userId } = await requireUser();
  const { projectId, phaseType } = await ctx.params;

  const project = await loadProjectWithPhases(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません。" }, { status: 404 });
  }

  const targetType = phaseType.toUpperCase() as PhaseType;
  if (!isPhaseUnlocked(project.phases, targetType)) {
    return NextResponse.json({ error: "このフェーズはまだ開始できません。" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "メッセージを入力してください。" }, { status: 400 });
  }

  const phase = project.phases.find((p) => p.type === targetType)!;

  const history = await prisma.chatMessage.findMany({
    where: { phaseId: phase.id },
    orderBy: { createdAt: "asc" },
  });

  const phasesWithDeliverables = await prisma.phase.findMany({
    where: { projectId },
    include: { deliverable: { select: { content: true } } },
  });

  await prisma.chatMessage.create({
    data: { phaseId: phase.id, role: "USER", content: parsed.data.message },
  });

  const systemPrompt = [buildHearingSystemPrompt(targetType), buildPriorContext(phasesWithDeliverables, phase.order)]
    .filter(Boolean)
    .join("\n\n");

  const claudeStream = anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [PROPOSE_FINALIZE_TOOL],
    messages: [
      ...history.map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: parsed.data.message },
    ],
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      claudeStream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });

      claudeStream.on("error", (error) => {
        controller.error(error);
      });

      try {
        const finalMessage = await claudeStream.finalMessage();

        const assistantText = finalMessage.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("");

        await prisma.chatMessage.create({
          data: { phaseId: phase.id, role: "ASSISTANT", content: assistantText },
        });

        const finalizeTool = finalMessage.content.find(
          (block) => block.type === "tool_use" && block.name === "propose_finalize",
        );

        if (finalizeTool && finalizeTool.type === "tool_use") {
          controller.enqueue(encoder.encode(FINALIZE_MARKER + JSON.stringify(finalizeTool.input)));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
