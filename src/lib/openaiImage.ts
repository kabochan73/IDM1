import "server-only";
import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// gpt-image-1は2026年10月23日に終了したため、推奨の後継モデルを使う。
export const IMAGE_MODEL = "gpt-image-2.5-flare";
