import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Serve build under /admin so assets resolve correctly when hosted at /admin/...
  base: "/admin/",
  plugins: [react()],
});
