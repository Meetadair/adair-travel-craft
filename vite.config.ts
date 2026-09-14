import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Server code — Duffel, Supabase SSR, Stripe — reads its secrets through
  // process.env. Vite only exposes VITE_-prefixed variables, and only to the
  // client, so the rest of .env is loaded here and put where the server
  // functions already look for it.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    server: { port: 8080, host: true },
    // One copy of each, or hooks break across the router/start boundary.
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
    plugins: [
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      // Redirect TanStack Start's bundled server entry to src/server.ts, our SSR
      // error wrapper; nitro builds from it.
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      viteReact(),
    ],
  };
});
