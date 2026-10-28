/**
 * 把本地数据暂存区(data-local/streamers)发布到数据源。
 * 默认发布为 Worker 静态资产(项目名 vupsong-config-data,自定义域名 data.vupsong.com);
 * 加 --pages 时发布到 Pages 项目 songlistdatacache(备用)。
 * 用法:node scripts/publish.mjs [--dry-run] [--pages]
 *
 * 流程:
 * 1. 扫描 data-local/streamers/<id>/{config,songs}.json(example/unavailable 不参与)
 * 2. 生成入驻清单 streamers.json(id + config,首页「入驻主播」板块运行时拉取)
 * 3. 组装到临时发布目录(.publish-tmp,含 _headers 跨源与缓存头)并 wrangler 直传
 *
 * 项目名可用环境变量 DATA_PROJECT 覆盖。依赖:`npx wrangler login` 已授权。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const asPages = process.argv.includes('--pages')
const PROJECT = process.env.DATA_PROJECT ?? (asPages ? 'songlistdatacache' : 'vupsong-config-data')
const STAGING_DIR = 'data-local/streamers'
const TMP_DIR = '.publish-tmp'
const EXCLUDED = new Set(['example', 'unavailable'])

const dryRun = process.argv.includes('--dry-run')
if (!existsSync(STAGING_DIR)) {
  console.error(`找不到 ${STAGING_DIR}(确认本地数据暂存区是否存在)`)
  process.exit(1)
}

/* ---------- 扫描主播数据并生成清单 ---------- */
const streamers = []
for (const entry of readdirSync(STAGING_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory() || EXCLUDED.has(entry.name)) continue
  const configPath = resolve(STAGING_DIR, entry.name, 'config.json')
  if (!existsSync(configPath)) {
    console.warn(`  跳过 ${entry.name}(缺 config.json)`)
    continue
  }
  try {
    streamers.push({ id: entry.name, config: JSON.parse(readFileSync(configPath, 'utf8')) })
  } catch {
    console.warn(`  跳过 ${entry.name}(config.json 解析失败)`)
  }
}
// 首页展示顺序:config.order 小者在前,未配置的按 id 字典序兜底
streamers.sort(
  (a, b) => (a.config.order ?? Infinity) - (b.config.order ?? Infinity) || a.id.localeCompare(b.id),
)

/* ---------- 组装临时发布目录 ---------- */
rmSync(TMP_DIR, { recursive: true, force: true })
mkdirSync(resolve(TMP_DIR, 'streamers'), { recursive: true })
for (const { id } of streamers) {
  cpSync(resolve(STAGING_DIR, id), resolve(TMP_DIR, 'streamers', id), { recursive: true })
}
// 跨源访问与缓存:json 走协商缓存(etag 304),数据更新立即可见
writeFileSync(
  resolve(TMP_DIR, '_headers'),
  '/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=0, must-revalidate\n',
)
writeFileSync(resolve(TMP_DIR, 'streamers.json'), JSON.stringify(streamers, null, 2) + '\n')

console.log(`待发布主播(${streamers.length}):${streamers.map((s) => s.id).join(', ')}`)
if (dryRun) {
  console.log(`--dry-run:未发布。预览目录 ${TMP_DIR}/ 已生成,可直接检查后手动删除。`)
  process.exit(0)
}

/* ---------- wrangler 直传(Worker 静态资产,--pages 时发布到 Pages 项目) ---------- */
if (asPages) {
  execSync(`npx wrangler pages deploy ${TMP_DIR} --project-name=${PROJECT} --branch=main --commit-dirty=true`, {
    stdio: 'inherit',
  })
} else {
  // 仅静态资产的 Worker:config 内声明 assets 目录,无脚本代码
  writeFileSync(
    resolve(TMP_DIR, 'wrangler.toml'),
    `name = "${PROJECT}"\ncompatibility_date = "2026-01-01"\n\n[assets]\ndirectory = "."\n`,
  )
  execSync(`npx wrangler deploy --config ${TMP_DIR}/wrangler.toml`, { stdio: 'inherit' })
}
rmSync(TMP_DIR, { recursive: true, force: true })
console.log(`✓ 已发布到 ${asPages ? 'Pages 项目' : 'Worker'} ${PROJECT},代码仓库无改动。`)
