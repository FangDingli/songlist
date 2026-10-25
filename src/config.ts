import type { Song, StreamerMeta } from '@/types'
import { songTags } from '@/utils/songs'

/** 默认主播:直接访问根路径时展示的主播 id,数据见 src/data/<id>.json(打包内置) */
export const DEFAULT_STREAMER_ID = 'qiyuan'

/**
 * 数据源基地址(构建时注入,如 https://data.vupsong.com),为空时同源拉取仓库文件。
 * 拉取顺序:数据源 → 同源仓库文件(兜底) → 默认主播内置数据 → 「没有找到主播」。
 */
export const DATA_BASE_URL = (import.meta.env.VITE_DATA_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

/** 拼接数据文件地址:配置了数据源时指向数据源,否则同源 */
export function dataUrl(path: string): string {
  return `${DATA_BASE_URL}${path}`
}

/** 默认主题种子色(meta.theme 未配置时使用),派生逻辑见 utils/theme.ts */
export const DEFAULT_THEME = '#1677FF'

/** 未拿到主播数据时的兜底文案与默认配置 */
export const FALLBACK_META: StreamerMeta = {
  title: '点歌单',
  subtitle: '点击卡片复制点歌口令,回到直播间粘贴即可点歌',
  orderTemplate: '点歌 {title} {singer}',
}

/** 用主播配置渲染点歌口令 */
export function formatOrder(song: Song, meta: StreamerMeta): string {
  const tpl = meta.orderTemplate ?? FALLBACK_META.orderTemplate!
  return tpl
    .replaceAll('{title}', song.title)
    .replaceAll('{singer}', song.singer)
    .replaceAll('{lang}', song.lang)
    .replaceAll('{tags}', songTags(song).join('、'))
}
