// 库构建：只打包 src/lib，输出 ESM；类型声明由 tsconfig.lib.json 单独生成
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    // 交给使用方的打包器去压缩，保留可读的产物方便排查
    minify: false,
    lib: {
      entry: 'src/lib/index.ts',
      formats: ['es'],
      fileName: () => 'cylinder-feed.js',
    },
  },
})
