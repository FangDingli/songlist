/**
 * 把本地主播数据反向转换为模板格式的 excel(可编辑后用 excel-to-json.mjs 再导入)。
 * 用法:node scripts/json-to-excel.mjs <主播id> [输出excel路径]
 * 默认输出:public/streamers/<id>/songlist.xlsx
 *
 * 严格以 public/songlist.xlsx 模板为基底构建:
 * - 工作表名/表头/站点配置的行序与「说明」「备注」引导文案全部取自模板原文件,
 *   本脚本只替换数据(歌曲行、站点配置的「填写内容」列),模板改动自动跟随
 *
 * 与 excel-to-json.mjs 互逆:
 * - 类型 = genre(多值用中文分号分隔,页面端按分隔符拆成 tag)
 * - 付费 = paid;无 paid 但有 sc 时合成「<sc>SC」;主题色强制标记(themeForced)
 *   以「!」前缀体现
 * - 歌切 = video(BV 号)、备注 = remark,原样写回
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import XLSX from 'xlsx'
import { deriveSeed } from './lib/theme-seed.mjs'

const TEMPLATE = resolve('public/songlist.xlsx')
const CONFIG_SHEET = '站点配置'

/** 站点配置 label → meta 字段(与 excel-to-json 的 CONFIG_FIELDS 一致,含模板外备份字段) */
const LABEL_KEYS = {
  歌单标题: 'title',
  副标题: 'subtitle',
  头像图片地址: 'avatar',
  '背景图-移动端': 'bg.mobile',
  '背景图-宽屏': 'bg.desktop',
  主题色: 'theme',
  点歌口令模板: 'orderTemplate',
  主播UID: 'uid',
  直播间ID: 'liveroomId',
  直播间: 'liveUrl',
  favicon: 'favicon',
}

const [streamerId, outArg] = process.argv.slice(2)
if (!streamerId) {
  console.error('用法:node scripts/json-to-excel.mjs <主播id> [输出excel路径]')
  process.exit(1)
}

// 数据优先读本地暂存区;example 等仓库兜底数据回落 public/streamers
let dataDir = resolve('data-local/streamers', streamerId)
if (!existsSync(dataDir)) dataDir = resolve('public/streamers', streamerId)
const songsPath = resolve(dataDir, 'songs.json')
if (!existsSync(songsPath)) {
  console.error(`找不到 ${resolve('data-local/streamers', streamerId, 'songs.json')}(确认主播 id 是否正确)`)
  process.exit(1)
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const songs = read(songsPath)
const configPath = resolve(dataDir, 'config.json')
const config = existsSync(configPath) ? read(configPath) : {}

// 派生字段:与 excel-to-json 导入时的生成规则一致,保证往返一致
if (!config.userProfileUrl && config.uid) config.userProfileUrl = `https://space.bilibili.com/${config.uid}`
if (!config.liveUrl && config.liveroomId) config.liveUrl = `https://live.bilibili.com/${config.liveroomId}`

/** 模板 → 写出基底(工作表名/表头/配置行文案全部来自模板) */
const tpl = XLSX.read(readFileSync(TEMPLATE), { type: 'buffer' })
const songsSheetName = tpl.SheetNames[0]
const songsTpl = XLSX.utils.sheet_to_json(tpl.Sheets[songsSheetName], { header: 1, defval: '' })
const configTpl = XLSX.utils.sheet_to_json(tpl.Sheets[CONFIG_SHEET], { header: 1, defval: '' })

/* ---------- 歌曲列表:模板表头 + 数据行 ---------- */
const songRows = [
  songsTpl[0], // 模板表头:歌名 | 歌手 | 语种 | 类型 | 付费 | 歌切 | 备注
  ...songs.map((s) => [
    s.title ?? '',
    s.singer ?? '',
    s.lang ?? '',
    s.genre ?? '',
    s.paid || (s.sc ? `${s.sc}SC` : ''),
    s.video ?? '',
    s.remark ?? '',
  ]),
]
const songsWs = XLSX.utils.aoa_to_sheet(songRows)
songsWs['!cols'] = tpl.Sheets[songsSheetName]?.['!cols'] ?? [{ wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 20 }]

/* ---------- 站点配置:模板行文案原样,仅替换「填写内容」列 ---------- */
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)
const paidOf = (s) => s.paid || (s.sc ? `${s.sc}SC` : '')
// 主题色强制标记(themeForced)以「!」前缀体现,与 excel-to-json 互逆
const themeCell = config.themeForced ? `!${config.theme ?? ''}` : String(config.theme ?? '')
const configRows = configTpl.map((row, i) => {
  if (i === 0) return row // 模板表头:字段 | 填写内容 | 说明 | 备注
  const label = String(row[0] ?? '')
  const key = LABEL_KEYS[label]
  if (!key) return row // 模板外/未识别行,原样保留
  let value = String(getPath(config, key) ?? '')
  if (key === 'theme') {
    // 与 excel-to-json 互逆:未标记强制时,导入方会做梯度调整,写回调整后的值
    value = config.themeForced ? themeCell : config.theme ? deriveSeed(config.theme) : ''
  }
  return [label, value, row[2] ?? '', row[3] ?? '']
})
const configWs = XLSX.utils.aoa_to_sheet(configRows)
configWs['!cols'] = tpl.Sheets[CONFIG_SHEET]?.['!cols'] ?? [{ wch: 16 }, { wch: 60 }, { wch: 36 }, { wch: 24 }]

/* ---------- 写出 ---------- */
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, songsWs, songsSheetName)
XLSX.utils.book_append_sheet(wb, configWs, CONFIG_SHEET)

const outPath = resolve(outArg ?? resolve(dataDir, 'songlist.xlsx'))
mkdirSync(dirname(outPath), { recursive: true })
XLSX.writeFile(wb, outPath)

console.log(`✓ 已写出 ${outPath}:歌曲 ${songs.length} 首,站点配置 ${configRows.length - 1} 行(按模板生成)`)
