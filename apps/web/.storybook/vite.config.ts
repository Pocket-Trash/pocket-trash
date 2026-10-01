import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: [
      "@base-ui/react/drawer",
      "@base-ui/react/select",
      "@base-ui/react/separator",
      "@base-ui/react/toggle",
      "@base-ui/react/toggle-group",
      "@base-ui/react/tooltip",
      "@milkdown/prose/keymap",
      "@milkdown/prose/tables",
      "vaul",
    ],
  },
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@pocket-trash\/localizations$/u,
        replacement: fileURLToPath(
          new URL(
            "../node_modules/@pocket-trash/localizations/dist/index.js",
            import.meta.url,
          ),
        ),
      },
      {
        find: "@/env/client",
        replacement: fileURLToPath(new URL("./env-client.ts", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("../src", import.meta.url)),
      },
    ],
  },
});
