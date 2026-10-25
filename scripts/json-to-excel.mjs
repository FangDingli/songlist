/**
 * 把本地主播数据反向转换为模板格式的 excel(可编辑后用 excel-to-json.mjs 再导入)。
 * 用法:node scripts/json-to-excel.mjs <主播id> [输出excel路径]
 * 默认输出:public/streamers/<id>/songlist.xlsx
 *
 * 与 excel-to-json.mjs 互逆:
 * - 「歌曲列表」:歌名 | 歌手 | 语种 | 类型 | 付费 | 歌切 | 备注
 *   - 类型 = genre(多值用中文分号分隔,页面端按分隔符拆成 tag)
 *   - 付费 = paid;无 paid 但有 sc 时合成「<sc>SC」
 *   - 歌切 = video(BV 号)、备注 = remark,原样写回
 * - 「站点配置」:字段 | 填写内容 | 说明 | 备注,与模板同序;
 *   liveUrl / favicon 为模板外字段,追加在末尾仅供备份,重新导入时不会被读取
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import XLSX from 'xlsx'

const SONGS_SHEET = '歌曲列表'
const CONFIG_SHEET = '站点配置'

/** 站点配置行:label 对应 excel-to-json 的 CONFIG_FIELDS 键,note 取自模板说明;
 * userProfileUrl / liveUrl 由 uid / liveroomId 派生(excel-to-json 导入时自动生成),不回写 */
const CONFIG_ROWS = [
  { label: '歌单标题', key: 'title', note: '浏览器标签页与侧栏标题' },
  { label: '副标题', key: 'subtitle', note: '侧栏小字' },
  { label: '头像图片地址', key: 'avatar', note: '唱片机中心头像' },
  { label: '背景图-移动端', key: 'bg.mobile', note: '窄屏背景，支持网络地址' },
  { label: '背景图-宽屏', key: 'bg.desktop', note: '宽屏背景，支持网络地址' },
  { label: '主题色', key: 'theme', note: '16进制色值，其他配色会自动计算' },
  { label: '点歌口令模板', key: 'orderTemplate', note: '占位符 {title} {singer} {lang} {tags}' },
  { label: '主播UID', key: 'uid', note: '' },
  { label: '直播间ID', key: 'liveroomId', note: '' },
]

/** 模板外的备份字段(excel-to-json 导入时忽略) */
const EXTRA_CONFIG_ROWS = [
  { label: '直播间', key: 'liveUrl', note: '由直播间ID派生,此处仅备份' },
  { label: 'favicon', key: 'favicon', note: '' },
]

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

/* ---------- 歌曲列表 ---------- */
const songRows = [
  ['歌名', '歌手', '语种', '类型', '付费', '歌切', '备注'],
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
songsWs['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 20 }]

/* ---------- 站点配置 ---------- */
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)
const configRows = [
  ['字段', '填写内容', '说明', '备注'],
  ...[...CONFIG_ROWS, ...EXTRA_CONFIG_ROWS].map(({ label, key, note }) => [
    label,
    String(getPath(config, key) ?? ''),
    note,
    EXTRA_CONFIG_ROWS.some((r) => r.key === key) ? '模板外字段,仅供备份' : '',
  ]),
]
const configWs = XLSX.utils.aoa_to_sheet(configRows)
configWs['!cols'] = [{ wch: 16 }, { wch: 60 }, { wch: 36 }, { wch: 24 }]

/* ---------- 写出 ---------- */
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, songsWs, SONGS_SHEET)
XLSX.utils.book_append_sheet(wb, configWs, CONFIG_SHEET)

const outPath = resolve(outArg ?? resolve(dataDir, 'songlist.xlsx'))
mkdirSync(dirname(outPath), { recursive: true })
XLSX.writeFile(wb, outPath)

console.log(`✓ 已写出 ${outPath}:歌曲 ${songs.length} 首,站点配置 ${configRows.length - 1} 行`)
