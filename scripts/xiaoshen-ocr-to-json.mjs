/**
 * xiaoshen songs.json 字段清洗与补齐
 * 用法:node scripts/xiaoshen-ocr-to-json.mjs(在仓库根目录执行)
 *
 * OCR 草稿已人工核对并转换为 songs.json(原始 txt 已清理),本脚本对其做后处理:
 * 1. 不知道的字段不写「未知」,一律留空
 * 2. 按歌名精确匹配补齐 singer/lang/genre:yarn 歌单优先,其次 song-database 全库;
 *    只填充空字段,已知的值(分区标注/更正结果)不被覆盖
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = resolve(ROOT, 'data-local/streamers/xiaoshen/songs.json')
const YARN = resolve(ROOT, 'data-local/streamers/yarn/songs.json')
const DATABASE = resolve(ROOT, 'data-local/song-database.json')

const songs = JSON.parse(readFileSync(TARGET, 'utf8'))

/** 按歌名建索引(同 title 后者不覆盖前者,与首次保留策略一致) */
function indexByTitle(file) {
  const map = new Map()
  for (const s of JSON.parse(readFileSync(file, 'utf8'))) {
    if (!map.has(s.title)) map.set(s.title, s)
  }
  return map
}
const yarnIndex = indexByTitle(YARN)
const dbIndex = indexByTitle(DATABASE)

let cleaned = 0
let enriched = 0
for (const s of songs) {
  for (const k of ['singer', 'lang', 'genre']) {
    if (s[k] === '未知') { s[k] = ''; cleaned++ }
  }
  const ref = yarnIndex.get(s.title) ?? dbIndex.get(s.title)
  if (!ref) continue
  const before = `${s.singer}/${s.lang}/${s.genre}`
  // 参考数据里的「未知」同样视为无值
  for (const k of ['singer', 'lang', 'genre']) {
    const v = ref[k] === '未知' ? '' : ref[k]
    if (v) s[k] = s[k] || v
  }
  if (`${s.singer}/${s.lang}/${s.genre}` !== before) enriched++
}

writeFileSync(TARGET, JSON.stringify(songs, null, 2) + '\n')
console.log(`共 ${songs.length} 首:清空「未知」${cleaned} 处,按歌名匹配补齐 ${enriched} 首(yarn 优先,其次 song-database)`)
