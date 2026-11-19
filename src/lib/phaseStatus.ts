import type { PhaseStatus } from "@/generated/prisma/client";

export const STATUS_LABEL: Record<PhaseStatus, string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
  NEEDS_REVIEW: "要見直し",
};

export const STATUS_DOT_CLASS: Record<PhaseStatus, string> = {
  NOT_STARTED: "bg-gray-300",
  IN_PROGRESS: "bg-brand-600",
  DONE: "bg-green-600",
  NEEDS_REVIEW: "bg-amber-500",
};

export const STATUS_BADGE_CLASS: Record<PhaseStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-500",
  IN_PROGRESS: "bg-brand-50 text-brand-700",
  DONE: "bg-green-50 text-green-700",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700",
};
