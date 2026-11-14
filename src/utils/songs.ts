import type { Song } from '@/types'

/** tag 类字段(genre/lang)的值分隔符:中英文分号、中英文逗号、顿号、斜杠 */
const SPLIT_RE = /[;；,，、\/]/

/** 按分隔符拆分、去空、去重(同一首歌内重复的值只计一次) */
function splitValues(value: unknown): string[] {
  return [...new Set(
    (typeof value === 'string' ? value.split(SPLIT_RE) : [])
      .map((s) => s.trim())
      .filter(Boolean),
  )]
}

/** 展示用 tag:genre 拆分;为空时返回空数组(纯歌名数据集不产生噪音) */
export function songTags(song: Song): string[] {
  return splitValues(song.genre)
}

/** 语种:与 genre 同一套分隔符,多语种歌曲(如「国语/日语」)拆成多个可筛选 tag */
export function songLangs(song: Song): string[] {
  return splitValues(song.lang)
}

/**
 * 给歌曲数据补上运行时 id(行序,1 起)。
 * 接受打包内置或远端拉取的原样 JSON,结构不符或无有效条目时抛错。
 */
export function withIds(raw: unknown): Song[] {
  if (!Array.isArray(raw)) throw new Error('歌曲数据应为数组')
  const songs = raw
    .filter((it): it is Song => !!it && typeof it === 'object' && String((it as Song).title ?? '').trim() !== '')
    .map((it, i) => ({ ...it, title: it.title.trim(), id: i + 1 }))
  if (!songs.length) throw new Error('歌曲数据没有有效条目')
  return songs
}
