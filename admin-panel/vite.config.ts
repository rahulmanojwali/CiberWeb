import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Ensure Vite always builds the workspace root index.html
  root: path.resolve(__dirname),

  build: {
    emptyOutDir: true,
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),

      // ✅ Recovery mode: stop vendor splitting completely.
      // This avoids init-order/circular dependency issues across chunks
      // that show up as "Cannot access '<minified>' before initialization"
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

// import { defineConfig } from "vite";
// import path from "path";
// import react from "@vitejs/plugin-react";

// export default defineConfig({
//   plugins: [react()],

//   // Ensure Vite always builds the workspace root index.html
//   root: path.resolve(__dirname),

//   build: {
//     emptyOutDir: true,
//     outDir: "dist",
//     chunkSizeWarningLimit: 1500,
//     rollupOptions: {
//       input: path.resolve(__dirname, "index.html"),
//       output: {
//         manualChunks(id) {
//           if (!id.includes("node_modules")) return;

//           if (
//             id.includes("/node_modules/react/") ||
//             id.includes("/node_modules/react-dom/") ||
//             id.includes("/node_modules/react-router/") ||
//             id.includes("/node_modules/react-router-dom/")
//           )
//             return "react-vendor";

//           if (id.includes("/node_modules/@refinedev/")) return "refine-vendor";

//           if (
//             id.includes("/node_modules/@mui/") ||
//             id.includes("/node_modules/@emotion/")
//           )
//             return "mui-vendor";

//           return "vendor";
//         },
//       },
//     },
//   },
// });
