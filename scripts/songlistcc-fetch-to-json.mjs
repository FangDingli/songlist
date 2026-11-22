/**
 * 在线抓取 songlist.cc(starlwr.com)歌单并转换为本站数据文件。
 * 用法:node scripts/songlistcc-fetch-to-json.mjs <地址或域名> [主播id] [--update] [--sync-config]
 *   输入兼容该站的三种线上地址形式(完整 URL/带 query 均可):
 *     bot.starlwr.com/songlist?uid=514442152
 *     shio.songlist.cc
 *     shiro.starlwr.com
 *   主播 id 缺省时取主机名第一段(shio.songlist.cc → shio);url 参数取主机名,
 *   uid 取地址 query 中的 uid,无则传 0。
 * 输出:data-local/streamers/<id>/songs.json + config.json(发布用 publish 脚本)
 *
 * 已存在的主播默认拒绝覆盖,避免误把手工配置冲掉。加 --update 才更新:
 *   --update      刷新 songs.json;保留本地 config.json 的站点设置,只更新数据日期
 *   --sync-config 更新时同步远端站点配置(背景图/口令/头像等手工设置会被覆盖)
 * 更新前旧文件备份到 data-local/backups/<id>/<时间戳>/,日志给出歌曲增删摘要;
 * 来源记入 data-local/songlistcc-sources.json,管理台据此提供「一键更新」。
 *
 * 原理:三种地址同一后端,POST https://api.starlwr.com/songlist/getView
 * (body {"url":"<主机名>","uid":<uid 或 0>}),响应即 songlist.cc 原生结构,
 * 转换逻辑与本地文件入口共用 scripts/lib/songlistcc-convert.mjs。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { convertSonglistcc } from './lib/songlistcc-convert.mjs'

const DEFAULT_THEME = '#1677FF'
const API = 'https://api.starlwr.com/songlist/getView'

const argv = process.argv.slice(2)
const doUpdate = argv.includes('--update')
const syncConfig = argv.includes('--sync-config')
const [input, idArg] = argv.filter((a) => a !== '--update' && a !== '--sync-config')
if (!input) {
  console.error('用法:node scripts/songlistcc-fetch-to-json.mjs <地址或域名> [主播id] [--update] [--sync-config]')
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
// 与 songlistcc-to-json.mjs 一致:禁止路径分隔符与 URL 特殊字符,避免写出暂存区之外
if (!/^[^/\\?#%]{1,32}$/.test(streamerId) || streamerId === '.' || streamerId === '..') {
  console.error(`非法主播 id:${streamerId}(不支持路径分隔符与 ?#%,≤32 字符)`)
  process.exit(1)
}

const outDir = new URL(`../data-local/streamers/${streamerId}/`, import.meta.url)
const songsPath = new URL('songs.json', outDir)
const configPath = new URL('config.json', outDir)
const hadLocal = existsSync(songsPath) || existsSync(configPath)
if (hadLocal && !doUpdate) {
  console.error(`主播 ${streamerId} 已存在。请加 --update 更新,或在管理台点「抓取并更新」/「songlist.cc 更新」。`)
  process.exit(1)
}

console.log(`抓取 ${host}(uid=${uid})→ 主播 ${streamerId}${doUpdate ? '(更新已有数据)' : '(新建)'}`)

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

/* ---------- 转换 ---------- */
const { songs, config } = convertSonglistcc(root)
if (!songs.length) {
  console.error('转换后没有有效歌曲')
  process.exit(1)
}

/* ---------- 更新前:读旧数据、备份 ---------- */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
const oldSongs = hadLocal && existsSync(songsPath) ? readJson(songsPath) : null
const oldConfig = hadLocal && existsSync(configPath) ? readJson(configPath) : null
let backupDir = ''
if (hadLocal) {
  // 同一秒内连续更新时追加序号,避免后者覆盖前一份备份
  const base = new Date().toLocaleString('sv').replace(/\D/g, '')
  let stamp = base
  for (let i = 2; existsSync(new URL(`../data-local/backups/${streamerId}/${stamp}/`, import.meta.url)); i++) {
    stamp = `${base}-${i}`
  }
  const backupUrl = new URL(`../data-local/backups/${streamerId}/${stamp}/`, import.meta.url)
  mkdirSync(backupUrl, { recursive: true })
  for (const [name, path] of [['songs.json', songsPath], ['config.json', configPath]]) {
    if (existsSync(path)) cpSync(path, new URL(name, backupUrl))
  }
  backupDir = `data-local/backups/${streamerId}/${stamp}/`
}

/** 按歌名比较增删(重名歌按出现次数抵消),日志最多列 5 首 */
function titleCounts(list) {
  const m = new Map()
  for (const s of list ?? []) m.set(s.title, (m.get(s.title) ?? 0) + 1)
  return m
}
function diffTitles(from, to) {
  const after = titleCounts(to)
  const out = []
  for (const [title, n] of titleCounts(from)) {
    for (let i = 0; i < n - (after.get(title) ?? 0); i++) out.push(title)
  }
  return out
}
function sample(list) {
  return list.length ? list.slice(0, 5).join('、') + (list.length > 5 ? ` 等 ${list.length} 首` : '') : '无'
}

/* ---------- 写出 ---------- */
mkdirSync(outDir, { recursive: true })
writeFileSync(songsPath, JSON.stringify(songs, null, 2) + '\n', 'utf8')

// 配置与数据分离:默认只刷新数据日期,背景图/别名/口令等手工设置原样保留
const baseConfig = oldConfig ?? {}
const nextConfig = hadLocal && !syncConfig
  ? { ...baseConfig, songsUpdatedAt: config.songsUpdatedAt }
  : { ...baseConfig, ...config }
writeFileSync(configPath, JSON.stringify(nextConfig, null, 2) + '\n', 'utf8')

// 来源映射给管理台用:下次可直接按主播一键更新,不必再填地址
const sourcesPath = new URL('../data-local/songlistcc-sources.json', import.meta.url)
let sources = {}
try {
  sources = JSON.parse(readFileSync(sourcesPath, 'utf8'))
} catch {
  /* 文件不存在或损坏时重建 */
}
sources[streamerId] = { host, uid, fetchedAt: new Date().toISOString() }
mkdirSync(new URL('../data-local/', import.meta.url), { recursive: true })
writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + '\n', 'utf8')

console.log(`✓ 已写入 data-local/streamers/${streamerId}/:songs.json 共 ${songs.length} 首,config.json(主题色 ${nextConfig.theme ?? `(默认 ${DEFAULT_THEME})`},数据日期 ${nextConfig.songsUpdatedAt})`)
if (hadLocal && Array.isArray(oldSongs)) {
  console.log(`  更新摘要:${oldSongs.length} → ${songs.length} 首;新增 ${sample(diffTitles(songs, oldSongs))};移除 ${sample(diffTitles(oldSongs, songs))}`)
  console.log(`  站点配置:${syncConfig ? '已同步远端' : '保留本地手工设置,仅刷新数据日期'};更新前文件备份于 ${backupDir}`)
} else if (hadLocal) {
  console.log(`  站点配置:${syncConfig ? '已同步远端' : '保留本地手工设置'};更新前文件备份于 ${backupDir}`)
}
console.log('  记得运行 node scripts/publish.mjs 发布到数据源。')
