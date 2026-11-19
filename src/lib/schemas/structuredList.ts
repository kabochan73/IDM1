import { z } from "zod";

export const StructuredListItemSchema = z.object({
  id: z.string().describe("例: PLAN-001 のようなID"),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["Must", "Should", "Could"]),
  relatedIds: z.array(z.string()).default([]),
});

export const StructuredListSchema = z.object({
  items: z.array(StructuredListItemSchema),
});

export type StructuredListContent = z.infer<typeof StructuredListSchema>;
