/**
 * 歌单图片生成:把全量歌名按多列排版绘制成竖版长图(供主播直接发动态),
 * 纯 Canvas 实现,超出单页容量自动分多张,逐张触发浏览器下载。
 *
 * 版式:白底黑字;页眉为主播歌单标题 + 总数与页码;列表带两位编号
 * (编号与页面歌曲顺序一致,观众报编号主播可直接对照)。
 * 画布按 2 倍尺寸渲染再以 CSS 尺寸绘制坐标,保证导出图在高分屏下清晰。
 */
import type { Song, StreamerMeta } from '@/types'

const SCALE = 2
const PAGE_W = 1600
const COLS = 4
const COL_W = PAGE_W / COLS
const ROW_H = 56
const HEADER_H = 150
const MARGIN = 40
const ROWS_PER_PAGE = Math.floor((2246 - HEADER_H - MARGIN * 2) / ROW_H) // 竖版 2:3 比例
const PER_PAGE = COLS * ROWS_PER_PAGE

const NAME_FONT = '24px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
const NO_FONT = '18px Consolas, "PingFang SC", sans-serif'
const HEADER_FONT = 'bold 40px "PingFang SC", "Microsoft YaHei", sans-serif'
const SUB_FONT = '22px "PingFang SC", "Microsoft YaHei", sans-serif'

/** 单行文本按最大宽度截断并追加省略号 */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolvePromise) => canvas.toBlob((b) => resolvePromise(b!), 'image/png'))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 触发浏览器下载(多张间隔触发,避免被"多文件下载"拦截合并) */
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
export async function buildSonglistImages(songs: Song[], meta: StreamerMeta): Promise<Array<{ blob: Blob; filename: string }>> {
  const totalPages = Math.ceil(songs.length / PER_PAGE)
  const title = meta.title || '歌单'
  const out: Array<{ blob: Blob; filename: string }> = []

  for (let page = 0; page < totalPages; page++) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W * SCALE
    canvas.height = 2246 * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    // 白底
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, PAGE_W, 2246)

    // 页眉:左侧标题,右侧总数与页码;下方一条主题色装饰线
    ctx.fillStyle = '#1F1F1F'
    ctx.font = HEADER_FONT
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(ctx, title, PAGE_W - MARGIN * 2 - 320), MARGIN, HEADER_H / 2)
    ctx.fillStyle = '#595959'
    ctx.font = SUB_FONT
    ctx.textAlign = 'right'
    ctx.fillText(`共 ${songs.length} 首 · 第 ${page + 1}/${totalPages} 张`, PAGE_W - MARGIN, HEADER_H / 2)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1677FF'
    ctx.fillRect(MARGIN, HEADER_H - 14, PAGE_W - MARGIN * 2, 4)

    // 列表:从左到右、从上到下;编号两位灰字 + 歌名,超长截断
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    for (let i = 0; i < PER_PAGE; i++) {
      const idx = page * PER_PAGE + i
      if (idx >= songs.length) break
      const song = songs[idx]
      const row = Math.floor(i / COLS)
      const col = i % COLS
      const x = MARGIN + col * COL_W
      const y = HEADER_H + MARGIN + row * ROW_H + ROW_H / 2

      ctx.fillStyle = '#8C8C8C'
      ctx.font = NO_FONT
      ctx.fillText(String(idx + 1).padStart(2, '0'), x + 48, y)

      ctx.fillStyle = '#1F1F1F'
      ctx.font = NAME_FONT
      ctx.fillText(truncate(ctx, song.title, COL_W - 64), x + 60, y)
    }

    out.push({ blob: await toBlob(canvas), filename: `${title}-歌单图片-${page + 1}.png` })
    if (page < totalPages - 1) await sleep(300)
  }

  return out
}

/**
 * 生成图片歌单并逐张下载。串行生成(几百首也就数秒),期间由调用方给 toast 反馈。
 */
export async function downloadSonglistImages(songs: Song[], meta: StreamerMeta): Promise<number> {
  const images = await buildSonglistImages(songs, meta)
  for (const { blob, filename } of images) download(blob, filename)
  return images.length
}
