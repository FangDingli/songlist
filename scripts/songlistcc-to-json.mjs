/**
 * 把 songlist.cc(xxx.songlist.cc)导出的 json 转换为本站数据文件。
 * 用法:node scripts/songlistcc-to-json.mjs <json路径> <主播id>
 * 输出:data-local/streamers/<id>/songs.json + config.json(发布用 publish 脚本)
 *
 * 字段映射(config 均在 data 字段内):
 * - title → title;face → avatar;subTitle → subtitle(非空时)
 * - backColor → theme:它是对方站点作为背景色使用的,直接做主色会过于寡淡,
 *   因此做一轮「提升饱和度、限制亮度」的梯度计算;值为 #FFEBCD 时视为对方
 *   默认色,省略 theme,使用本站默认 #1677FF
 * - command → orderTemplate 前缀(如「点歌」→「点歌 {title} {singer}」)
 * - uid → uid + userProfileUrl(B 站主页);roomId → liveroomId + liveUrl(直播间)
 * - backImage/mobileBackImage → bg(非空时)
 *
 * 歌曲映射(data.songs):
 * - name → title;singer → singer;style → genre
 * - pay + guard + gift → paid 字符串:30 →「30SC」;guard 1/2/3 →「舰长/提督/总督」;
 *   gift 优先用 data.gifts 字典里的礼物名,缺失时为「礼物#ID」
 * - video(BV号)与 remark 原样保留,页面暂不展示
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { deriveSeed as deriveThemeSeed } from './lib/theme-seed.mjs'

/** 与 src/config.ts 的 DEFAULT_THEME 保持一致(Node 无法解析 @/ 别名,故此处内联) */
const DEFAULT_THEME = '#1677FF'

const [jsonPath, streamerId] = process.argv.slice(2)
if (!jsonPath || !streamerId) {
  console.error('用法:node scripts/songlistcc-to-json.mjs <json路径> <主播id>')
  process.exit(1)
}
if (!existsSync(jsonPath)) {
  console.error(`找不到文件:${jsonPath}`)
  process.exit(1)
}
if (!/^[^/\\]{1,32}$/.test(streamerId)) {
  console.error(`非法主播 id:${streamerId}(不支持路径分隔符,≤32 字符)`)
  process.exit(1)
}

const str = (v) => String(v ?? '').trim()
const num = (v) => Number(v)

/**
 * 背景色 → 适合做主色的种子色(梯度算法见 scripts/lib/theme-seed.mjs)。
 * #FFEBCD 视为对方站点的默认色,返回 null 以省略 theme。
 */
function deriveSeed(backColor) {
  if (/^#FFEBCD$/i.test(backColor)) return null
  return deriveThemeSeed(backColor)
}

const GUARD_NAMES = { 1: '舰长', 2: '提督', 3: '总督' }

/** 礼物字典的值可能是字符串或 {name, icon} 对象,统一取礼物名 */
function giftName(dict, id) {
  const g = dict[String(id)]
  if (!g) return `礼物#${id}`
  return typeof g === 'string' ? g : str(g.name) || `礼物#${id}`
}

const root = JSON.parse(readFileSync(jsonPath, 'utf8'))
const data = root.data ?? root

/* ---------- config ---------- */
const today = new Date().toLocaleDateString('sv') // 本地日期(ISO 会取 UTC 日期,东八区晚间差一天)
const config = {}
if (str(data.title)) config.title = str(data.title)
if (str(data.subTitle)) config.subtitle = str(data.subTitle)
if (str(data.face)) config.avatar = str(data.face)
const bg = {}
if (str(data.mobileBackImage)) bg.mobile = str(data.mobileBackImage)
if (str(data.backImage)) bg.desktop = str(data.backImage)
if (Object.keys(bg).length) config.bg = bg
const themeSeed = deriveSeed(data.backColor)
if (themeSeed) config.theme = themeSeed
if (str(data.command)) config.orderTemplate = `${str(data.command)} {title} {singer}`
if (data.uid) {
  config.uid = str(data.uid)
  config.userProfileUrl = `https://space.bilibili.com/${str(data.uid)}`
}
if (data.roomId) {
  config.liveroomId = str(data.roomId)
  config.liveUrl = `https://live.bilibili.com/${str(data.roomId)}`
}
// 站点配置中的静态资源是相对文件名时无法还原完整地址,仅接受完整 URL
for (const [key, path] of [['icon', 'favicon'], ['backImage', 'bg.desktop'], ['mobileBackImage', 'bg.mobile']]) {
  const v = str(data[key])
  if (/^https?:\/\//.test(v)) {
    const keys = path.split('.')
    let obj = config
    keys.slice(0, -1).forEach((k) => (obj = obj[k] ??= {}))
    obj[keys.at(-1)] = v
  }
}
config.songsUpdatedAt = today

/* ---------- songs ---------- */
const giftDict = data.gifts ?? {}
const songs = []
for (const item of data.songs ?? []) {
  const title = str(item.name)
  if (!title) continue

  const paidParts = []
  const pay = num(item.pay)
  if (Number.isFinite(pay) && pay > 0) paidParts.push(`${pay % 1 === 0 ? Math.round(pay) : pay}SC`)
  const guard = num(item.guard)
  if (Number.isFinite(guard) && guard > 0) paidParts.push(GUARD_NAMES[guard] ?? `大航海${guard}`)
  if (item.gift) paidParts.push(giftName(giftDict, item.gift))

  songs.push({
    title,
    singer: str(item.singer),
    lang: str(item.language),
    genre: str(item.style),
    paid: paidParts.join('、') || undefined,
    video: str(item.video) || undefined,
    remark: str(item.remark) || undefined,
  })
}
if (!songs.length) {
  console.error('没有解析到有效歌曲(data.songs 为空,以 name 字段为准)')
  process.exit(1)
}

/* ---------- 输出(合并已有 config 的手工字段,如背景图) ---------- */
// 数据写入本地暂存区(gitignored),由 publish 脚本发布到数据源,不进代码仓库
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

console.log(`✓ 已写入 data-local/streamers/${streamerId}/:songs.json 共 ${songs.length} 首,config.json(主题色 ${config.theme ?? `(默认 ${DEFAULT_THEME})`},数据日期 ${today})`)
console.log('  记得运行 node scripts/publish.mjs 发布到数据源。')
