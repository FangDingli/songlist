/**
 * 把 songlist.cc(xxx.songlist.cc)导出的 json 文件转换为本站数据文件。
 * 用法:node scripts/songlistcc-to-json.mjs <json路径> <主播id>
 * 输出:data-local/streamers/<id>/songs.json + config.json(发布用 publish 脚本)
 * 在线抓取同一数据的入口见 songlistcc-fetch-to-json.mjs(转换逻辑共用本目录
 * songlistcc-convert.mjs,字段映射说明见下)。
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { convertSonglistcc } from './lib/songlistcc-convert.mjs'

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

const { songs, config } = convertSonglistcc(JSON.parse(readFileSync(jsonPath, 'utf8')))

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

console.log(`✓ 已写入 data-local/streamers/${streamerId}/:songs.json 共 ${songs.length} 首,config.json(主题色 ${config.theme ?? `(默认 ${DEFAULT_THEME})`},数据日期 ${config.songsUpdatedAt})`)
console.log('  记得运行 node scripts/publish.mjs 发布到数据源。')
