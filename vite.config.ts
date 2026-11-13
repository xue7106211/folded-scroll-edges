// 演示站是多页：主页 + explore/ 下的探索页
import { defineConfig } from 'vite'

const page = (p: string) => new URL(p, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: page('./index.html'),
        scroll: page('./explore/scroll.html'),
        decay: page('./explore/decay.html'),
        loop: page('./explore/loop.html'),
        breath: page('./explore/breath.html'),
      },
    },
  },
})
