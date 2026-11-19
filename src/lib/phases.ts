import type { DeliverableFormat, PhaseType } from "@/generated/prisma/client";

export type PhaseConfig = {
  type: PhaseType;
  order: number;
  labelJa: string;
  format: DeliverableFormat;
};

export const PHASE_ORDER: PhaseConfig[] = [
  { type: "PLANNING", order: 1, labelJa: "企画", format: "STRUCTURED_LIST" },
  { type: "REQUIREMENTS", order: 2, labelJa: "要件定義", format: "STRUCTURED_LIST" },
  { type: "FUNCTIONAL_DESIGN", order: 3, labelJa: "機能設計", format: "STRUCTURED_LIST" },
  { type: "SCREEN_DESIGN", order: 4, labelJa: "画面設計", format: "WIREFRAME" },
  { type: "DB_DESIGN", order: 5, labelJa: "DB設計", format: "ER_DIAGRAM" },
  { type: "DETAILED_DESIGN", order: 6, labelJa: "詳細設計", format: "STRUCTURED_LIST" },
  { type: "TEST_DESIGN", order: 7, labelJa: "テスト設計", format: "STRUCTURED_LIST" },
  { type: "IMPLEMENTATION_CHECKLIST", order: 8, labelJa: "実装TODOチェックリスト", format: "CHECKLIST" },
];

export function getPhaseConfig(type: PhaseType): PhaseConfig {
  const config = PHASE_ORDER.find((p) => p.type === type);
  if (!config) throw new Error(`Unknown phase type: ${type}`);
  return config;
}
