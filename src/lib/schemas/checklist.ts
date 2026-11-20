import { z } from "zod";

// AIによる生成時はdoneを持たない(生成後にdone:falseを付与、再生成時は既存のdoneを引き継ぐ)。
export const ChecklistGenerationItemSchema = z.object({
  id: z.string().describe("例: TODO-001"),
  label: z.string().describe("実装すべきタスクの説明"),
  relatedFunctionalItem: z.string().optional().describe("対応する機能設計の項目ID(例: FUNC-001)"),
});

export const ChecklistGenerationSchema = z.object({
  items: z.array(ChecklistGenerationItemSchema),
});

export const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  relatedFunctionalItem: z.string().optional(),
  done: z.boolean(),
});

export const ChecklistContentSchema = z.object({
  items: z.array(ChecklistItemSchema),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type ChecklistContent = z.infer<typeof ChecklistContentSchema>;
