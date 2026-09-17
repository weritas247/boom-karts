import { createFileRoute } from "@tanstack/react-router";
import GameApp from "@/game/GameApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh w-full overflow-hidden bg-bg text-fg">
      <GameApp />
    </main>
  );
}
