import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

/**
 * dev 专用:把本地数据暂存区 data-local/streamers 以同源 /streamers/* 提供
 * (并动态生成 streamers.json),本地开发不依赖线上数据源;
 * 构建后由 VITE_DATA_BASE_URL 指向的数据源接管,见 scripts/publish.mjs。
 */
function localData(): Plugin {
  const dir = fileURLToPath(new URL('./data-local/streamers', import.meta.url))
  const jsonType = 'application/json;charset=utf-8'
  return {
    name: 'local-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (url === '/streamers.json') {
          const list = existsSync(dir)
            ? readdirSync(dir, { withFileTypes: true })
                .filter((e) => e.isDirectory())
                .filter((e) => existsSync(`${dir}/${e.name}/config.json`))
                .map((e) => ({ id: e.name, config: JSON.parse(readFileSync(`${dir}/${e.name}/config.json`, 'utf8')) }))
                // 首页展示顺序:config.order 小者在前,未配置的按 id 字典序兜底
                .sort(
                  (a, b) =>
                    (a.config.order ?? Infinity) - (b.config.order ?? Infinity) || a.id.localeCompare(b.id),
                )
            : []
          res.setHeader('Content-Type', jsonType)
          res.end(JSON.stringify(list))
          return
        }
        if (url.startsWith('/streamers/')) {
          const file = fileURLToPath(new URL(`./data-local${decodeURIComponent(url)}`, import.meta.url))
          if (existsSync(file) && statSync(file).isFile()) {
            res.setHeader('Content-Type', jsonType)
            res.end(readFileSync(file))
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), UnoCSS(), localData()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
