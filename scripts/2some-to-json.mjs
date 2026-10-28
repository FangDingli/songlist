/**
 * 从 2some.ren(2SOMEone)站点抓取主播歌单,转换为本站数据文件。
 * 用法:node scripts/2some-to-json.mjs <2some主播slug> [主播id]
 *   slug 为站点路径段(如 https://2some.ren/moling/songs 的 moling);
 *   主播 id 缺省时与 slug 相同。
 * 输出:data-local/streamers/<id>/songs.json(config.json 需另行编写)
 *
 * 原理:该站为 Next.js SSR,页面路由 POST 仅返回 HTML(有接口防护);
 * 翻页走 Server Action,action id 硬编码在页面 JS 的 createServerReference
 * 调用中。本脚本以 Next-Action 头直呼 getSongList,位置参数
 * [pageNum, pageSize, "<slug>"]。若站点更新导致 action id 失效,重新从
 * 页面 chunk 中搜索 getSongList 附近的 42 位 hex 串替换 ACTION 即可。
 *
 * 字段映射:
 * - songName → title;singers 数组顿号 join → singer(项目约定分隔符)
 * - language → lang;genre → genre
 * - 该站当前无付费标记(guardLevel 恒 none、giftPrice 恒空、sc 恒 0),
 *   memo 恒「无」,无歌曲切片,故 paid/remark/video/sc 均不写
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ACTION = '78614605db2f148df9c8a95462058ea4345b734082' // getSongList
const API_BASE = 'https://2some.ren'
const PAGE_SIZE = 50
const MAX_PAGES = 40

const [slug, idArg] = process.argv.slice(2)
if (!slug) {
  console.error('用法:node scripts/2some-to-json.mjs <2some主播slug> [主播id]')
  process.exit(1)
}
const streamerId = idArg || slug
const outDir = resolve(ROOT, 'data-local/streamers', streamerId)

const all = new Map()
for (let page = 1; page <= MAX_PAGES; page++) {
  const res = await fetch(`${API_BASE}/${slug}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Next-Action': ACTION },
    body: JSON.stringify([page, PAGE_SIZE, slug]),
  })
  if (!res.ok) {
    console.error(`第 ${page} 页请求失败:HTTP ${res.status}(action id 可能已失效,见脚本头注释)`)
    process.exit(1)
  }
  const text = await res.text()
  // RSC 流式响应:数据在 "1:" 开头的行
  let data = null
  for (const line of text.split('\n')) {
    if (line.startsWith('1:')) {
      data = JSON.parse(line.slice(2))
      break
    }
  }
  const items = data?.items ?? []
  if (items.length === 0) break
  for (const it of items) all.set(it.id, it)
  console.log(`第 ${page} 页:${items.length} 首,累计 ${all.size}`)
  if (items.length < PAGE_SIZE) break
  // 礼貌间隔,避免触发站点限流
  await new Promise((r) => setTimeout(r, 800))
}

if (all.size === 0) {
  console.error('未抓到任何歌曲:确认 slug 是否正确、站点结构是否变化')
  process.exit(1)
}

const songs = [...all.values()].map((s) => ({
  title: s.songName,
  singer: (s.singers?.length ? s.singers : [s.singer]).join('、'),
  lang: s.language ?? '',
  genre: s.genre ?? '',
}))

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'songs.json'), JSON.stringify(songs, null, 2) + '\n')
console.log(`✓ 已写出 ${resolve(outDir, 'songs.json')}:共 ${songs.length} 首`)
