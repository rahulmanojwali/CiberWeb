import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Serve build under /admin so assets resolve correctly when hosted at /admin/...
  base: "/admin/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^notistack$/,
        replacement: path.resolve(__dirname, "src/notistack-compat.tsx"),
      },
    ],
  },
});
