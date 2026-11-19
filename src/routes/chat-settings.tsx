import { createFileRoute } from "@tanstack/react-router";

import { InstagramShell } from "@/components/InstagramShell";

export const Route = createFileRoute("/chat-settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Reading Corner" },
      {
        name: "description",
        content: "Manage your personal info, gallery, NFC card link, themes, and blocked users.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatSettingsRoute,
});

function ChatSettingsRoute() {
  return <InstagramShell initialTab="profile" initialProfileSection="settings" />;
}
