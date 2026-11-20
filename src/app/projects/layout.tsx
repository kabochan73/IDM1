import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} />
      <main className="min-w-0 flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
