import { z } from "zod";

const FieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  isPK: z.boolean().default(false),
  isFK: z.boolean().default(false),
});

const EntitySchema = z.object({
  name: z.string(),
  fields: z.array(FieldSchema),
});

export const ErDiagramContentSchema = z.object({
  mermaid: z.string().describe("MermaidのerDiagram記法のソース(表示用の正本)"),
  entities: z.array(EntitySchema).describe("mermaidの内容と対応するエンティティ一覧(整合性チェック等のプログラム的参照用)"),
});

export type ErDiagramContent = z.infer<typeof ErDiagramContentSchema>;
