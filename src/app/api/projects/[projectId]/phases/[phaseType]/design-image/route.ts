import { NextResponse } from "next/server";
import { z } from "zod";
import { toFile } from "openai";
import type { PhaseType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { loadProjectWithPhases, isPhaseUnlocked } from "@/lib/phaseGuard";
import { getPhaseConfig } from "@/lib/phases";
import { openai, IMAGE_MODEL } from "@/lib/openaiImage";
import { screenElementsToText } from "@/lib/deliverableToMarkdown";
import type { WireframeElement } from "@/lib/schemas/wireframe";

const RequestSchema = z.object({
  screenName: z.string().min(1),
  feedback: z.string().max(1000).optional(),
});

type WireframeContent = {
  screens: { name: string; elements: WireframeElement[] }[];
  transitionsMermaid: string;
  designImages?: { screenName: string; imageBase64: string; prompt: string }[];
};

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/phases/[phaseType]/design-image">,
) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "画像生成に失敗しました。" }, { status: 502 });
  }

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

  if (getPhaseConfig(targetType).format !== "WIREFRAME") {
    return NextResponse.json({ error: "このフェーズではデザインイメージ生成は使えません。" }, { status: 501 });
  }

  const phase = project.phases.find((p) => p.type === targetType)!;
  const deliverable = await prisma.deliverable.findUnique({ where: { phaseId: phase.id } });
  if (!deliverable) {
    return NextResponse.json({ error: "まだ画面構成が確定していません。" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が正しくありません。" }, { status: 400 });
  }

  const content = deliverable.content as WireframeContent;
  const screen = content.screens.find((s) => s.name === parsed.data.screenName);
  if (!screen) {
    return NextResponse.json({ error: "画面が見つかりません。" }, { status: 404 });
  }

  // 企画フェーズのコンセプトから、デザインの一言トーンを拾う(あれば)。
  const planningPhase = project.phases.find((p) => p.type === "PLANNING");
  let toneLine = "";
  if (planningPhase) {
    const planningDeliverable = await prisma.deliverable.findUnique({ where: { phaseId: planningPhase.id } });
    const planningContent = planningDeliverable?.content as { items?: { title: string; description: string }[] } | undefined;
    const conceptItem = planningContent?.items?.find((i) => i.title.includes("コンセプト"));
    if (conceptItem) toneLine = `このアプリ全体のコンセプト: ${conceptItem.description}\n`;
  }

  const elementsText = screenElementsToText(screen.elements);
  const feedback = parsed.data.feedback || "シンプルで見やすいデザインにしてください。";
  const prompt = `${toneLine}画面「${screen.name}」のUIデザインのモックアップを作成してください。\n画面の構成要素:\n${elementsText}\n見た目の要望: ${feedback}`;

  const existingImages = content.designImages ?? [];
  const existingImage = existingImages.find((img) => img.screenName === screen.name);

  let imageBase64: string;
  try {
    if (existingImage) {
      const imageFile = await toFile(Buffer.from(existingImage.imageBase64, "base64"), "screen.png", {
        type: "image/png",
      });
      const result = await openai.images.edit({ model: IMAGE_MODEL, image: imageFile, prompt });
      imageBase64 = result.data?.[0]?.b64_json ?? "";
    } else {
      const result = await openai.images.generate({ model: IMAGE_MODEL, prompt });
      imageBase64 = result.data?.[0]?.b64_json ?? "";
    }
  } catch (error) {
    console.error("design-image generation failed:", error);
    return NextResponse.json({ error: "画像生成に失敗しました。" }, { status: 502 });
  }

  if (!imageBase64) {
    return NextResponse.json({ error: "画像生成に失敗しました。" }, { status: 502 });
  }

  const newDesignImages = [
    ...existingImages.filter((img) => img.screenName !== screen.name),
    { screenName: screen.name, imageBase64, prompt },
  ];

  const newContent: Prisma.InputJsonValue = { ...content, designImages: newDesignImages };

  await prisma.deliverable.update({
    where: { phaseId: phase.id },
    data: { content: newContent, version: deliverable.version + 1 },
  });

  return NextResponse.json({ ok: true, designImages: newDesignImages });
}
