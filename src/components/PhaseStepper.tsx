import Link from "next/link";
import type { Phase } from "@/generated/prisma/client";
import { getPhaseConfig } from "@/lib/phases";
import { STATUS_DOT_CLASS, STATUS_LABEL } from "@/lib/phaseStatus";

export function PhaseStepper({
  projectId,
  phases,
  currentType,
}: {
  projectId: string;
  phases: Phase[];
  currentType?: string;
}) {
  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <ol className="flex flex-wrap gap-2">
      {sorted.map((phase) => {
        const config = getPhaseConfig(phase.type);
        const reachable = phase.status !== "NOT_STARTED";
        const isCurrent = phase.type.toLowerCase() === currentType;

        const content = (
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${
              isCurrent ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"
            }`}
            title={STATUS_LABEL[phase.status]}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[phase.status]}`} />
            {config.order}. {config.labelJa}
          </span>
        );

        return (
          <li key={phase.id}>
            {reachable ? (
              <Link href={`/projects/${projectId}/phases/${phase.type.toLowerCase()}`}>{content}</Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
