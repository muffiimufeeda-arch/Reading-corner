import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    vite: { installDevServerMiddleware: true },
  },
  nitro: {
    preset: process.env["VERCEL"] === "1" ? "vercel" : "node-server",
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      hmr: process.env["DISABLE_HMR"] !== "true",
      watch: process.env["DISABLE_HMR"] === "true" ? null : {},
    },
  },
});
