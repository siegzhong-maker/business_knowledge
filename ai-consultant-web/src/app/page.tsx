import { ResizableWorkspace } from "@/features/layout/ResizableWorkspace";

export default function Home() {
  return (
    <main className="bg-slate-50 text-slate-800 font-sans h-screen w-screen overflow-hidden flex">
      <ResizableWorkspace />
    </main>
  );
}
