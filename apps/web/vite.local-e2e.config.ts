import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@/lib/catalog-copy",
        replacement: fileURLToPath(
          new URL("./e2e/local/src/catalog-copy.ts", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
  root: fileURLToPath(new URL("./e2e/local", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
  },
});
