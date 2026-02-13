import { ChatInterface } from '@/features/chat/ChatInterface';
import { CanvasContainer } from '@/features/canvas/CanvasContainer';

export default function Home() {
  return (
    <main className="bg-slate-50 text-slate-800 font-sans h-screen w-screen overflow-hidden flex">
       <ChatInterface />
       <CanvasContainer />
    </main>
  );
}
