/**
 * 在线抓取 songlist.cc(starlwr.com)歌单并转换为本站数据文件。
 * 用法:node scripts/songlistcc-fetch-to-json.mjs <地址或域名> [主播id]
 *   输入兼容该站的三种线上地址形式(完整 URL/带 query 均可):
 *     bot.starlwr.com/songlist?uid=514442152
 *     shio.songlist.cc
 *     shiro.starlwr.com
 *   主播 id 缺省时取主机名第一段(shio.songlist.cc → shio);url 参数取主机名,
 *   uid 取地址 query 中的 uid,无则传 0。
 * 输出:data-local/streamers/<id>/songs.json + config.json(发布用 publish 脚本)
 *
 * 原理:三种地址同一后端,POST https://api.starlwr.com/songlist/getView
 * (body {"url":"<主机名>","uid":<uid 或 0>}),响应即 songlist.cc 原生结构,
 * 转换逻辑与本地文件入口共用 scripts/lib/songlistcc-convert.mjs。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { convertSonglistcc } from './lib/songlistcc-convert.mjs'

const DEFAULT_THEME = '#1677FF'
const API = 'https://api.starlwr.com/songlist/getView'

const [input, idArg] = process.argv.slice(2)
if (!input) {
  console.error('用法:node scripts/songlistcc-fetch-to-json.mjs <地址或域名> [主播id]')
  process.exit(1)
}

/* ---------- 解析输入 → { url, uid } ---------- */
let host = ''
let uid = 0
const trimmed = input.trim()
try {
  const u = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  host = u.hostname
  if (u.searchParams.has('uid')) uid = u.searchParams.get('uid') || 0
} catch {
  host = trimmed.split('/')[0]
}
if (!host || !host.includes('.')) {
  console.error(`无法从输入解析出主机名:${trimmed}(示例:shio.songlist.cc 或完整地址)`)
  process.exit(1)
}
const streamerId = idArg || host.split('.')[0]

console.log(`抓取 ${host}(uid=${uid})→ 主播 ${streamerId}`)

/* ---------- 请求 getView ---------- */
const res = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: host, uid }),
})
if (!res.ok) {
  console.error(`请求失败:HTTP ${res.status}`)
  process.exit(1)
}
const root = await res.json()
if (root.code !== undefined && root.code !== 0 && root.code !== 200) {
  console.error(`接口返回错误:code=${root.code}, ${root.msg ?? root.message ?? ''}`)
  process.exit(1)
}
const count = (root.data ?? root).songs?.length ?? 0
if (!count) {
  console.error('响应中没有歌曲数据(检查地址是否有效)')
  process.exit(1)
}
console.log(`接口返回 ${count} 首`)

/* ---------- 转换并写出 ---------- */
const { songs, config } = convertSonglistcc(root)
if (!songs.length) {
  console.error('转换后没有有效歌曲')
  process.exit(1)
}

const outDir = new URL(`../data-local/streamers/${streamerId}/`, import.meta.url)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('songs.json', outDir), JSON.stringify(songs, null, 2) + '\n', 'utf8')

const configPath = new URL('config.json', outDir)
const existingConfig = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
writeFileSync(
  configPath,
  JSON.stringify({ ...existingConfig, ...config }, null, 2) + '\n',
  'utf8',
)

console.log(`✓ 已写入 data-local/streamers/${streamerId}/:songs.json 共 ${songs.length} 首,config.json(主题色 ${config.theme ?? `(默认 ${DEFAULT_THEME})`},数据日期 ${config.songsUpdatedAt})`)
console.log('  记得运行 node scripts/publish.mjs 发布到数据源。')
