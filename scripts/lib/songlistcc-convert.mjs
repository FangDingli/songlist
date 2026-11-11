/**
 * songlist.cc(starlwr.com)歌单数据 → 本站数据文件的共享转换逻辑。
 * 被 songlistcc-to-json.mjs(本地 json 文件)与 songlistcc-fetch-to-json.mjs
 * (在线抓取)两个入口共用,避免转换逻辑漂移。
 *
 * 输入:getView 接口的响应 JSON(或其 data 字段,两种结构均兼容)。
 * 输出:{ songs, config },字段映射见 songlistcc-to-json.mjs 头注释。
 */
import { deriveSeed as deriveThemeSeed } from './theme-seed.mjs'

/** 与 src/config.ts 的 DEFAULT_THEME 保持一致 */
const DEFAULT_THEME = '#1677FF'

const str = (v) => String(v ?? '').trim()
const num = (v) => Number(v)

/**
 * 背景色 → 适合做主色的种子色(梯度算法见 theme-seed.mjs)。
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

/** songlist.cc 原生数据 → 本站 songs.json 条目 */
export function convertSonglistcc(root) {
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

  return { songs, config, DEFAULT_THEME }
}
