import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/router.ts",
      formats: ["es"],
      fileName: () => "router.js",
    },
    rollupOptions: {
      external: [/^lit(\/.*)?$/],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  publicDir: false,
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
});
