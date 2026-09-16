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
      "vaul",
    ],
  },
  plugins: [tailwindcss()],
  resolve: {
    alias: [
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
