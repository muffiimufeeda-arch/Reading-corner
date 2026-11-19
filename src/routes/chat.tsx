import { createFileRoute } from "@tanstack/react-router";

import { InstagramShell } from "@/components/InstagramShell";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Reading Corner" },
      {
        name: "description",
        content: "Real-time private chat with photos, videos, read receipts, and blocking.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatRoute,
});

function ChatRoute() {
  return <InstagramShell initialTab="chat" />;
}
