/**
 * 把主播填写的模板 excel 转换为数据与配置文件。
 * 用法:node scripts/excel-to-json.mjs <excel路径> <主播id>
 * 输出:data-local/streamers/<id>/songs.json + config.json(发布用 publish 脚本)
 *
 * 模板含两个工作表(表头/字段名不可修改):
 * - 「歌曲列表」:歌名 | 歌手 | 语种 | 类型 | 付费 | 歌切 | 备注
 *   - 类型:多值用中英文分号分隔,整串存入 genre,页面按分隔符拆成 tag
 *   - 歌手:顿号、中英文分号、& 均可识别,输出统一为顿号
 *   - 付费:有值表示点歌需要付费/SC(如「30SC」「舰长」),原样存入 paid
 *   - 歌切:B 站视频 BV 号,原样存入 video;备注:原样存入 remark
 * - 「站点配置」:字段 | 填写内容 两列,生成 config.json(meta)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import XLSX from 'xlsx'

const SONGS_SHEET = '歌曲列表'
const CONFIG_SHEET = '站点配置'

/** 站点配置工作表中文字段 → meta 字段(支持 bg.mobile 点路径) */
const CONFIG_FIELDS = {
  歌单标题: 'title',
  副标题: 'subtitle',
  头像图片地址: 'avatar',
  '背景图-移动端': 'bg.mobile',
  '背景图-宽屏': 'bg.desktop',
  主题色: 'theme',
  点歌口令模板: 'orderTemplate',
  主播UID: 'uid',
  直播间ID: 'liveroomId',
}

const [excelPath, streamerId] = process.argv.slice(2)
if (!excelPath || !streamerId) {
  console.error('用法:node scripts/excel-to-json.mjs <excel路径> <主播id>')
  process.exit(1)
}
if (!existsSync(excelPath)) {
  console.error(`找不到文件:${excelPath}`)
  process.exit(1)
}
if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(streamerId)) {
  console.error(`非法主播 id:${streamerId}(仅允许小写字母/数字/连字符)`)
  process.exit(1)
}

const wb = XLSX.read(readFileSync(excelPath), { type: 'buffer' })

/* ---------- 歌曲列表(兼容旧模板首表名为 songlist 的情况) ---------- */
const songsSheet = wb.Sheets[SONGS_SHEET] ?? wb.Sheets[wb.SheetNames[0]]
if (!songsSheet) {
  console.error(`缺少「${SONGS_SHEET}」工作表`)
  process.exit(1)
}
const str = (v) => String(v ?? '').trim()
const songs = []
for (const row of XLSX.utils.sheet_to_json(songsSheet, { defval: '' })) {
  const title = str(row['歌名'])
  if (!title) continue

  const remark = str(row['付费'])

  songs.push({
    title,
    singer: str(row['歌手']).split(/[;；&]/).map((s) => s.trim()).filter(Boolean).join('、') || '未知',
    lang: str(row['语种']) || '未知',
    genre: str(row['类型']),
    paid: remark || undefined,
    video: str(row['歌切']) || undefined,
    remark: str(row['备注']) || undefined,
  })
}
if (!songs.length) {
  console.error('没有解析到有效歌曲(检查「歌曲列表」表头是否为:歌名/歌手/语种/类型/付费/歌切/备注)')
  process.exit(1)
}

/* ---------- 站点配置(可选;未填时保留已有 config 或输出仅含标题的初始配置) ---------- */
let config = {}
const configSheet = wb.Sheets[CONFIG_SHEET]
if (configSheet) {
  for (const row of XLSX.utils.sheet_to_json(configSheet, { header: 1 }).slice(1)) {
    const key = CONFIG_FIELDS[str(row[0])]
    const value = str(row[1])
    if (!key || !value) continue
    const keys = key.split('.')
    let obj = config
    keys.slice(0, -1).forEach((k) => (obj = obj[k] ??= {}))
    obj[keys.at(-1)] = value
  }
}

const today = new Date().toISOString().slice(0, 10)

// 由 uid / liveroomId 派生主页与直播间地址(与 config.json 的字段规则一致)
if (config.uid) config.userProfileUrl = `https://space.bilibili.com/${config.uid}`
if (config.liveroomId) config.liveUrl = `https://live.bilibili.com/${config.liveroomId}`

// 数据写入本地暂存区(gitignored),由 publish 脚本发布到数据源,不进代码仓库
const outDir = new URL(`../data-local/streamers/${streamerId}/`, import.meta.url)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('songs.json', outDir), JSON.stringify(songs, null, 2) + '\n', 'utf8')

const configPath = new URL('config.json', outDir)
const existingConfig = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
writeFileSync(
  configPath,
  JSON.stringify({ ...existingConfig, ...config, songsUpdatedAt: today }, null, 2) + '\n',
  'utf8',
)

console.log(`✓ 已写入 data-local/streamers/${streamerId}/:songs.json 共 ${songs.length} 首,config.json(数据日期 ${today})`)
console.log('  记得运行 node scripts/publish.mjs 发布到数据源。')
