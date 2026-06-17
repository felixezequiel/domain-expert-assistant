import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The SPA is served at the same origin as the API by the Node monolith
// (ADR-023). base "/" keeps asset URLs root-relative so SpaController can
// serve them under /assets/. The dev proxy forwards API calls to the
// monolith on :3000 so `credentials: "include"` works during local dev.
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/auth": "http://localhost:3000",
      "/items": "http://localhost:3000",
      "/collections": "http://localhost:3000",
      "/tags": "http://localhost:3000",
      "/credentials": "http://localhost:3000",
      "/organizations": "http://localhost:3000",
      "/users": "http://localhost:3000",
      "/invitations": "http://localhost:3000",
      "/search": "http://localhost:3000",
      "/index": "http://localhost:3000",
      "/ingestion": "http://localhost:3000",
      "/audit": "http://localhost:3000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
