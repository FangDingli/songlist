<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { avatarCandidates, avatarFallbackBg, avatarThumb } from '@/utils/avatar'

const props = defineProps<{
  /** B 站 uid:存在时优先动态解析头像,跟随主播换头像 */
  uid?: string
  /** 静态头像:动态解析失败时的兜底,同时作为容器背景垫底 */
  avatar?: string
  /** 手动指定头像:只用静态 avatar,不通过 uid 动态解析 */
  avatarManual?: boolean
  /** 直接指定头像地址(优先于 uid/avatar),用于二维码 logo 等已有 URL 的场景 */
  src?: string
  /** 直接指定兜底图(优先于 avatar) */
  fallback?: string
  /** 无头像时音符图标的尺寸类 */
  iconClass?: string
  /** 圆角类:默认圆形头像,方形场景传 rounded-lg */
  rounded?: string
  alt?: string
}>()

const fallbackSrc = computed(() => props.fallback?.trim() || props.avatar?.trim() || '')

/** 候选链:动态解析(或显式 src) → 静态兜底,去重 */
const candidates = computed(() => {
  const list = props.src?.trim()
    ? [props.src.trim(), props.fallback?.trim() ?? '']
    : avatarCandidates({ uid: props.uid, avatar: props.avatar, avatarManual: props.avatarManual })
  return [...new Set(list.filter(Boolean))]
})

const failed = ref(0)
watch(
  [() => props.uid, () => props.avatar, () => props.avatarManual, () => props.src, () => props.fallback],
  () => (failed.value = 0),
)
const current = computed(() => candidates.value[failed.value] ?? '')
const bg = computed(() => avatarFallbackBg(fallbackSrc.value))

/** 加载失败时降级到下一个候选 */
function degrade() {
  failed.value++
}
</script>

<template>
  <!-- 兜底背景必须设在包裹 img 的容器上:设在 img 上会被图片内容盖住,
       而 img 加载失败被隐藏时又连背景一起隐藏,两种情况都兜不住 -->
  <div
    class="relative shrink-0 bg-brand-soft bg-cover bg-center overflow-hidden flex-center"
    :class="rounded ?? 'rounded-full'"
    :style="bg ? { backgroundImage: bg } : undefined"
  >
    <img
      v-if="current"
      :src="avatarThumb(current)"
      class="w-full h-full object-cover"
      :class="rounded ?? 'rounded-full'"
      :alt="alt ?? ''"
      referrerpolicy="no-referrer"
      @error="degrade"
    />
    <div v-else class="i-carbon-music text-brand" :class="iconClass ?? 'text-24px'"></div>
  </div>
</template>
