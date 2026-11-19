import { Sidebar } from "@/components/Sidebar";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
