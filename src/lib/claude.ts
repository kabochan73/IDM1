import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CLAUDE_MODEL = "claude-opus-5-5";

export const PROPOSE_FINALIZE_TOOL: Anthropic.Tool = {
  name: "propose_finalize",
  description:
    "このフェーズの必須の観点が十分に埋まり、確定(finalize)してよいと判断したときに呼び出す。任意の観点は埋まっていなくてもよい。",
  input_schema: {
    type: "object",
    properties: {
      readiness: { type: "string", enum: ["ready"] },
      rationale: { type: "string", description: "なぜ確定してよいと判断したかの簡潔な理由" },
    },
    required: ["readiness", "rationale"],
  },
};
