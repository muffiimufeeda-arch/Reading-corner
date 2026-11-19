import { createFileRoute } from "@tanstack/react-router";

import { InstagramShell } from "@/components/InstagramShell";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Reading Corner" },
      {
        name: "description",
        content: "Private real-time chat, profile gallery, themes, and personal NFC card links.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesRoute,
});

function MessagesRoute() {
  return <InstagramShell initialTab="chat" />;
}
