/**
 * 歌单图片生成:把全量歌名按多列排版绘制成竖版长图(供主播直接发动态),
 * 纯 Canvas 实现,超出单页容量自动分多张。
 *
 * 可自定义(均可选,缺省用默认值):
 * - textColor:歌名/编号/页眉文字色;bgColor:纯色背景
 * - bgImage:背景图(dataURL 或 URL,cover 铺满;加载失败回落 bgColor,
 *   并给文字区域加半透明衬底保证可读)
 * - width/height:画布尺寸(px),列数随宽度自适应(≥1200 四列/≥800 三列,否则两列)
 *
 * 版式:页眉为主播歌单标题 + 总数与页码 + 主题色装饰线;列表带两位编号
 * (编号与页面歌曲顺序一致,观众报编号主播可直接对照)。
 * 画布按 2 倍尺寸渲染,保证导出图在高分屏下清晰。
 */
import type { Song, StreamerMeta } from '@/types'

const SCALE = 2
const MIN_SIZE = 800
const MAX_SIZE = 4000
const ROW_H = 56
const HEADER_H = 150
const MARGIN = 40

const NAME_FONT = '24px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
const NO_FONT = '18px Consolas, "PingFang SC", sans-serif'
const HEADER_FONT = 'bold 40px "PingFang SC", "Microsoft YaHei", sans-serif'
const SUB_FONT = '22px "PingFang SC", "Microsoft YaHei", sans-serif'

export interface SonglistImageOptions {
  textColor?: string
  bgColor?: string
  bgImage?: string
  width?: number
  height?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 由画布尺寸计算排版参数(列数随宽度自适应) */
export function songlistLayout(width: number, height: number) {
  const w = clamp(width, MIN_SIZE, MAX_SIZE)
  const h = clamp(height, MIN_SIZE, MAX_SIZE)
  const cols = w >= 1200 ? 4 : w >= 800 ? 3 : 2
  const rowsPerPage = Math.floor((h - HEADER_H - MARGIN * 2) / ROW_H)
  return { width: w, height: h, cols, colW: w / cols, rowH: ROW_H, headerH: HEADER_H, margin: MARGIN, rowsPerPage, perPage: cols * rowsPerPage }
}

/** hex → rgba 字符串(非 hex 输入原样返回) */
function withAlpha(color: string, alpha: number): string {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (!m) return color
  const v = Number.parseInt(m[1], 16)
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`
}

/** 单行文本按最大宽度截断并追加省略号 */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolvePromise, reject) => {
    const img = new Image()
    img.onload = () => resolvePromise(img)
    img.onerror = reject
    img.src = src
  })
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolvePromise) => canvas.toBlob((b) => resolvePromise(b!), 'image/png'))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 触发浏览器下载 */
function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * 构建全部图片歌单(不触发下载),按页返回 { blob, filename }。
 * 供下载入口与测试/预览复用。
 */
export async function buildSonglistImages(
  songs: Song[],
  meta: StreamerMeta,
  options: SonglistImageOptions = {},
): Promise<Array<{ blob: Blob; filename: string }>> {
  const L = songlistLayout(options.width ?? 1600, options.height ?? 2246)
  const textColor = options.textColor?.trim() || '#1F1F1F'
  const bgColor = options.bgColor?.trim() || '#FFFFFF'
  const decorColor = meta.theme || '#1677FF'
  const totalPages = Math.ceil(songs.length / L.perPage)
  const title = meta.title || '歌单'

  // 背景图(cover 铺满),加载失败回落纯色
  let bgImg: HTMLImageElement | null = null
  if (options.bgImage) {
    try { bgImg = await loadImage(options.bgImage) } catch { bgImg = null }
  }

  const out: Array<{ blob: Blob; filename: string }> = []
  for (let page = 0; page < totalPages; page++) {
    const canvas = document.createElement('canvas')
    canvas.width = L.width * SCALE
    canvas.height = L.height * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    // 背景:图 cover 铺满,或纯色
    if (bgImg) {
      const scale = Math.max(L.width / bgImg.width, L.height / bgImg.height)
      const w = bgImg.width * scale
      const h = bgImg.height * scale
      ctx.drawImage(bgImg, (L.width - w) / 2, (L.height - h) / 2, w, h)
    } else {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, L.width, L.height)
    }

    // 页眉:左侧标题,右侧总数与页码;下方一条主题色装饰线
    ctx.fillStyle = textColor
    ctx.font = HEADER_FONT
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(ctx, title, L.width - L.margin * 2 - 320), L.margin, L.headerH / 2)
    ctx.fillStyle = withAlpha(textColor, 0.75)
    ctx.font = SUB_FONT
    ctx.textAlign = 'right'
    ctx.fillText(`共 ${songs.length} 首 · 第 ${page + 1}/${totalPages} 张`, L.width - L.margin, L.headerH / 2)
    ctx.textAlign = 'left'
    ctx.fillStyle = decorColor
    ctx.fillRect(L.margin, L.headerH - 14, L.width - L.margin * 2, 4)

    // 背景图模式:文字区加半透明衬底,保证任意背景图上歌名可读
    if (bgImg) {
      ctx.fillStyle = withAlpha(bgColor === '#FFFFFF' ? '#FFFFFF' : bgColor, 0.72)
      ctx.fillRect(0, L.headerH, L.width, L.height - L.headerH)
    }

    // 列表:从左到右、从上到下;编号两位灰字 + 歌名,超长截断
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    for (let i = 0; i < L.perPage; i++) {
      const idx = page * L.perPage + i
      if (idx >= songs.length) break
      const song = songs[idx]
      const row = Math.floor(i / L.cols)
      const col = i % L.cols
      const x = L.margin + col * L.colW
      const y = L.headerH + L.margin + row * L.rowH + L.rowH / 2

      ctx.fillStyle = withAlpha(textColor, 0.55)
      ctx.font = NO_FONT
      ctx.fillText(String(idx + 1).padStart(2, '0'), x + 48, y)

      ctx.fillStyle = textColor
      ctx.font = NAME_FONT
      ctx.fillText(truncate(ctx, song.title, L.colW - 64), x + 60, y)
    }

    out.push({
      blob: await toBlob(canvas),
      filename: `${title}-歌单图片-${page + 1}.png`,
    })
    if (page < totalPages - 1) await sleep(300)
  }

  return out
}

/**
 * 生成图片歌单并逐张下载。串行生成(几百首也就数秒),期间由调用方给 toast 反馈。
 */
export async function downloadSonglistImages(
  songs: Song[],
  meta: StreamerMeta,
  options: SonglistImageOptions = {},
): Promise<number> {
  const images = await buildSonglistImages(songs, meta, options)
  for (const { blob, filename } of images) download(blob, filename)
  return images.length
}
