import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/router.ts",
      formats: ["es"],
      fileName: () => "router.js",
    },
    rolldownOptions: {
      external: [/^lit(\/.*)?$/],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  publicDir: false,
  plugins: [
    dts({
      beforeWriteFile(filePath, content) {
        return {
          filePath,
          content: content.replace(
            /(from\s+['"]\.{1,2}\/[^'"]+)\.ts(['"])/g,
            "$1.js$2",
          ),
        };
      },
    }),
  ],
});
