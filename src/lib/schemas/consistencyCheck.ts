import { z } from "zod";

export const ConsistencyFindingSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  phasesInvolved: z.array(z.string()).describe("関係するフェーズの日本語名(例: 要件定義, DB設計)"),
  description: z.string().describe("矛盾・懸念点の説明"),
  suggestion: z.string().optional().describe("直すとしたらどうするかの提案"),
});

export const ConsistencyCheckResultSchema = z.object({
  findings: z.array(ConsistencyFindingSchema),
  summary: z.string().describe("全体として整合性が取れているかどうかの簡潔なまとめ"),
});

export type ConsistencyCheckResult = z.infer<typeof ConsistencyCheckResultSchema>;
