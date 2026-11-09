import { defineConfig } from "vite";

export default defineConfig({
  configFile: false,
  build: {
    lib: {
      entry: "src/router.ts",
      formats: ["es"],
      fileName: () => "router.bundle.js",
    },
    outDir: "dist-e2e",
    emptyOutDir: true,
  },
  publicDir: false,
});
