import type { DeliverableFormat, PhaseType } from "@/generated/prisma/client";

export type PhaseConfig = {
  type: PhaseType;
  order: number;
  labelJa: string;
  format: DeliverableFormat;
  /** AIが聞き出すべき観点。確定提案(readiness: "ready")の判断基準になる。 */
  required: string[];
  optional: string[];
};

export const PHASE_ORDER: PhaseConfig[] = [
  {
    type: "PLANNING",
    order: 1,
    labelJa: "企画",
    format: "STRUCTURED_LIST",
    required: ["サービス名", "背景・課題", "コンセプト", "ターゲットユーザー", "ゴール・成功基準", "非対象"],
    optional: ["差別化ポイント", "開発体制・制約", "将来的な拡張"],
  },
  {
    type: "REQUIREMENTS",
    order: 2,
    labelJa: "要件定義",
    format: "STRUCTURED_LIST",
    required: ["機能要件一覧(各項目に優先度Must/Should/Couldを付与)"],
    optional: ["非機能要件", "制約条件", "優先度の方針の明文化"],
  },
  {
    type: "FUNCTIONAL_DESIGN",
    order: 3,
    labelJa: "機能設計",
    format: "STRUCTURED_LIST",
    required: ["要件定義の各項目に対応する機能が最低1つ存在すること(網羅性)"],
    optional: ["機能のグルーピングの綺麗さ", "粒度の細かさ"],
  },
  {
    type: "SCREEN_DESIGN",
    order: 4,
    labelJa: "画面設計",
    format: "WIREFRAME",
    required: ["機能設計の各機能がどこかの画面に対応づけられていること(網羅性)", "各画面の主要な要素構成", "画面遷移図"],
    optional: ["デザインイメージ(参考画像)", "細かいレイアウトやスタイリングの調整"],
  },
  {
    type: "DB_DESIGN",
    order: 5,
    labelJa: "DB設計",
    format: "ER_DIAGRAM",
    required: ["画面設計で出てきた各画面の入力・表示項目が、どこかのテーブル・カラムに対応していること(網羅性)", "エンティティ同士の関係(外部キー)"],
    optional: ["カラムの型の細かい最適化", "インデックス設計", "正規化の厳密さ"],
  },
  {
    type: "DETAILED_DESIGN",
    order: 6,
    labelJa: "詳細設計",
    format: "STRUCTURED_LIST",
    required: ["機能設計の各機能に対応するAPI・処理が最低1つ存在すること(網羅性)", "複雑な分岐がある処理のフロー"],
    optional: ["エラーハンドリングの細部", "外部連携の実装詳細"],
  },
  {
    type: "TEST_DESIGN",
    order: 7,
    labelJa: "テスト設計",
    format: "STRUCTURED_LIST",
    required: ["機能設計/詳細設計の各項目に対応するテストケースが最低1つ存在すること(網羅性)"],
    optional: ["異常系・エッジケースの細かさ", "手順の詳細さ"],
  },
  {
    type: "IMPLEMENTATION_CHECKLIST",
    order: 8,
    labelJa: "実装TODOチェックリスト",
    format: "CHECKLIST",
    required: [],
    optional: [],
  },
];

export function getPhaseConfig(type: PhaseType): PhaseConfig {
  const config = PHASE_ORDER.find((p) => p.type === type);
  if (!config) throw new Error(`Unknown phase type: ${type}`);
  return config;
}

export function buildHearingSystemPrompt(type: PhaseType): string {
  const config = getPhaseConfig(type);
  return [
    `あなたはWeb開発の設計を支援するインタビュアーです。今は「${config.labelJa}」フェーズのヒアリング中です。`,
    `実装やコード生成は絶対に行わず、設計を固めることだけに集中してください。`,
    ``,
    `このフェーズで必ず聞き出すべき観点(必須):`,
    ...config.required.map((r) => `- ${r}`),
    ``,
    `聞けると良いが無くても確定できる観点(任意):`,
    ...(config.optional.length > 0 ? config.optional.map((o) => `- ${o}`) : ["(なし)"]),
    ``,
    `ユーザーの回答を踏まえて、構造化された項目(ID・タイトル・説明・優先度・関連ID)の形で提案してください。`,
    `必須の観点がすべて十分に埋まったと判断したら、propose_finalizeツールを呼び出して確定を提案してください(任意の観点は埋まっていなくても構いません)。`,
  ].join("\n");
}
