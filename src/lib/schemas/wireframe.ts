import { z } from "zod";

export const WIREFRAME_ELEMENT_TYPES = [
  "header",
  "text",
  "button",
  "input",
  "image",
  "list",
  "nav",
  "container",
  "table",
] as const;

// Claudeの構造化出力(output_config.format)は循環参照スキーマ(自己再帰)をサポートしないため、
// 要素の入れ子は2階層まで(container/nav/list等が葉要素を持てる)に固定する。
const LeafElementSchema = z.object({
  type: z.enum(WIREFRAME_ELEMENT_TYPES),
  label: z.string().describe("要素の表示内容やラベル(例: 'ログイン'というボタンなら'ログイン')"),
});

export type LeafElement = z.infer<typeof LeafElementSchema>;

export const WireframeElementSchema = z.object({
  type: z.enum(WIREFRAME_ELEMENT_TYPES),
  label: z.string().describe("要素の表示内容やラベル(例: 'ログイン'というボタンなら'ログイン')"),
  children: z.array(LeafElementSchema).default([]).describe("container/nav/list等の内側に入る葉要素(最大1階層まで)"),
});

export type WireframeElement = z.infer<typeof WireframeElementSchema>;

export const ScreenSchema = z.object({
  name: z.string(),
  elements: z.array(WireframeElementSchema),
});

export const WireframeContentSchema = z.object({
  screens: z.array(ScreenSchema),
  transitionsMermaid: z.string().describe("画面同士のつながりを表すMermaidのflowchart記法のソース"),
});

export type WireframeContent = z.infer<typeof WireframeContentSchema>;
