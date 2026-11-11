<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { downloadSonglistImages, songlistLayout } from '@/utils/songlist-image'
import type { Song, StreamerMeta } from '@/types'

const props = defineProps<{
  songs: Song[]
  meta: StreamerMeta
}>()

const { show } = useToast()

// 自定义选项(空值 = 用内置默认);生成时传给 buildSonglistImages
const open = ref(false)
const imgGenerating = ref(false)
const textColor = ref('')
const bgColor = ref('')
const bgImage = ref('') // dataURL;空 = 纯色背景
const bgImageName = ref('')
const width = ref(1600)
const height = ref(2246)

const SIZE_PRESETS = [
  { label: '竖版 1600×2246', w: 1600, h: 2246 },
  { label: '方图 1600×1600', w: 1600, h: 1600 },
  { label: '横版 2246×1600', w: 2246, h: 1600 },
]
const sizePreset = ref('1600x2246')

watch(sizePreset, (v) => {
  const p = SIZE_PRESETS.find((x) => `${x.w}x${x.h}` === v)
  if (p) { width.value = p.w; height.value = p.h }
})

// 自定义选项持久化(全局,不分主播——排版口味通常一致)
const STORAGE_KEY = 'songlist-image-options'
watch([textColor, bgColor, bgImage, width, height], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    textColor: textColor.value, bgColor: bgColor.value, bgImage: bgImage.value,
    width: width.value, height: height.value,
  }))
}, { deep: true })
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  if (saved.textColor) textColor.value = saved.textColor
  if (saved.bgColor) bgColor.value = saved.bgColor
  if (saved.bgImage) { bgImage.value = saved.bgImage; bgImageName.value = '上次使用的背景图' }
  if (saved.width) width.value = saved.width
  if (saved.height) height.value = saved.height
} catch { /* 忽略损坏的持久化数据 */ }

// 预计页数(与 songlistLayout 同一套公式)
const pageCount = computed(() => {
  const L = songlistLayout(width.value, height.value)
  return Math.max(1, Math.ceil(props.songs.length / L.perPage))
})

const options = computed(() => ({
  textColor: textColor.value || undefined,
  bgColor: bgColor.value || undefined,
  bgImage: bgImage.value || undefined,
  width: width.value,
  height: height.value,
}))

async function generate() {
  if (imgGenerating.value) return
  imgGenerating.value = true
  show('开始生成图片歌单…')
  try {
    const pages = await downloadSonglistImages(props.songs, props.meta, options.value)
    show(`已生成 ${pages} 张图片并开始下载`)
  } catch {
    show('图片歌单生成失败', 'error')
  } finally {
    imgGenerating.value = false
  }
}

function onBgFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { bgImage.value = String(reader.result); bgImageName.value = file.name }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function clearBgImage() {
  bgImage.value = ''
  bgImageName.value = ''
}
</script>

<template>
  <div class="surface-card p-20px">
    <button type="button" class="w-full flex items-center justify-between" @click="open = !open">
      <span class="text-15px font-bold text-text-primary">图片歌单</span>
      <div
        class="i-carbon-chevron-down text-14px text-text-secondary transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      ></div>
    </button>

    <div v-show="open" class="mt-12px flex flex-col gap-10px">
      <!-- 文字颜色 -->
      <div class="flex items-center gap-8px">
        <label class="w-64px shrink-0 text-12px text-text-secondary">文字颜色</label>
        <input v-model="textColor" type="color" class="h-26px w-40px cursor-pointer border border-border rounded bg-bg-card p-0" />
        <button v-if="textColor" type="button" class="text-11px text-text-secondary hover:text-text-primary"
          @click="textColor = ''">重置</button>
      </div>

      <!-- 背景颜色 -->
      <div class="flex items-center gap-8px">
        <label class="w-64px shrink-0 text-12px text-text-secondary">背景颜色</label>
        <input v-model="bgColor" type="color" class="h-26px w-40px cursor-pointer border border-border rounded bg-bg-card p-0" />
        <button v-if="bgColor" type="button" class="text-11px text-text-secondary hover:text-text-primary"
          @click="bgColor = ''">重置</button>
      </div>

      <!-- 背景图 -->
      <div class="flex items-center gap-8px">
        <label class="w-64px shrink-0 text-12px text-text-secondary">背景图片</label>
        <button type="button" class="btn-soft text-12px" @click="($refs.bgFile as HTMLInputElement).click()">
          {{ bgImage ? '更换' : '选择图片' }}
        </button>
        <span v-if="bgImageName" class="min-w-0 text-11px text-text-secondary truncate">{{ bgImageName }}</span>
        <button v-if="bgImage" type="button" class="text-11px text-error hover:opacity-80"
          @click="clearBgImage">移除</button>
        <input ref="bgFile" type="file" accept="image/*" class="hidden" @change="onBgFile" />
      </div>

      <!-- 尺寸 -->
      <div class="flex items-center gap-8px">
        <label class="w-64px shrink-0 text-12px text-text-secondary">图片尺寸</label>
        <select v-model="sizePreset"
          class="h-28px flex-1 rounded-lg border border-border bg-bg-card px-6px text-12px text-text-primary outline-none">
          <option v-for="p in SIZE_PRESETS" :key="p.label" :value="`${p.w}x${p.h}`">{{ p.label }}</option>
          <option value="custom">自定义…</option>
        </select>
        <div class="flex items-center gap-4px" :class="sizePreset === 'custom' ? '' : 'hidden'">
          <input v-model.number="width" type="number" min="800" max="4000" step="10"
            class="h-28px w-70px rounded-lg border border-border bg-bg-card px-6px text-12px text-text-primary outline-none" />
          <span class="text-12px text-text-secondary">×</span>
          <input v-model.number="height" type="number" min="800" max="4000" step="10"
            class="h-28px w-70px rounded-lg border border-border bg-bg-card px-6px text-12px text-text-primary outline-none" />
        </div>
      </div>

      <!-- 生成 -->
      <button type="button" class="btn-soft w-full" :disabled="imgGenerating || !songs.length" @click="generate">
        {{ imgGenerating ? '生成中…' : `生成并下载（${pageCount} 张）` }}
      </button>
      <p class="text-11px text-text-secondary text-center">
        全量歌名排成竖版图,编号与页面歌曲顺序一致,可直接发动态
      </p>
    </div>
  </div>
</template>
