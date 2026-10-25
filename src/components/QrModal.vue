<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  open: boolean
  /** 二维码内容(一般为当前主播页的完整地址) */
  url: string
  /** 居中嵌入的图片(主播头像),缺省则纯二维码 */
  logo?: string
  title: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

async function render() {
  ready.value = false
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas) return
  try {
    await QRCode.toCanvas(canvas, props.url, {
      width: 512,
      margin: 2,
      color: { dark: '#1F1F1F', light: '#FFFFFF' },
    })
    ready.value = true
  } catch {
    ready.value = false
  }
}

watch(
  () => [props.open, props.url],
  ([open]) => {
    if (open) render()
  },
  { immediate: true },
)

/** 圆角矩形路径 */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function download() {
  const off = document.createElement('canvas')
  try {
    await QRCode.toCanvas(off, props.url, {
      width: 1024,
      margin: 2,
      color: { dark: '#1F1F1F', light: '#FFFFFF' },
    })
    if (props.logo) {
      // 头像来自外部 CDN 时可能不支持跨域绘制,失败则退化为纯二维码
      try {
        const img = await loadImage(props.logo)
        const ctx = off.getContext('2d')!
        const size = off.width * 0.22
        const x = (off.width - size) / 2
        const y = (off.height - size) / 2
        ctx.fillStyle = '#FFFFFF'
        roundRectPath(ctx, x, y, size, size, size * 0.16)
        ctx.fill()
        ctx.save()
        roundRectPath(ctx, x, y, size, size, size * 0.16)
        ctx.clip()
        ctx.drawImage(img, x, y, size, size)
        ctx.restore()
      } catch {
        /* 退化为纯二维码 */
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => off.toBlob(resolve, 'image/png'))
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${props.title}-二维码.png`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    showGenerateError()
  }
}

let errorTimer: ReturnType<typeof setTimeout> | undefined
const generateError = ref(false)
function showGenerateError() {
  generateError.value = true
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => (generateError.value = false), 2000)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-90 bg-black/45 flex-center p-16px"
    @click.self="emit('close')"
  >
    <div class="surface-card p-24px flex flex-col items-center gap-12px w-full max-w-340px">
      <h3 class="text-16px font-bold text-text-primary">{{ title }}</h3>
      <div class="relative">
        <canvas ref="canvasRef" class="w-256px h-256px rounded-xl block"></canvas>
        <div v-if="ready && logo" class="absolute inset-0 flex-center pointer-events-none">
          <div class="bg-bg-card rounded-xl p-6px border border-border">
            <img
              :src="logo"
              class="w-56px h-56px rounded-lg object-cover"
              alt=""
              referrerpolicy="no-referrer"
            />
          </div>
        </div>
        <div v-if="!ready" class="absolute inset-0 flex-center bg-bg-card rounded-xl">
          <div class="i-carbon-music text-32px text-brand animate-pulse"></div>
        </div>
      </div>
      <p class="text-12px text-text-secondary">扫码打开歌单</p>
      <div class="flex gap-8px">
        <button type="button" class="btn-soft" :disabled="!ready" @click="download">下载 PNG</button>
        <button type="button" class="btn-soft" @click="emit('close')">关闭</button>
      </div>
      <p v-if="generateError" class="text-12px text-error">生成失败,请重试</p>
    </div>
  </div>
</template>
