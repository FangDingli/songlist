<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { avatarCandidates, avatarFallbackBg } from '@/utils/avatar'

const props = defineProps<{
  /** 静态头像地址,动态解析失败时的兜底 */
  avatar?: string
  /** 主播 uid,存在时通过解析服务动态获取(跟随 B 站头像更新) */
  uid?: string
  /** 点击跳转的直播间,缺省则不可点击 */
  href?: string
}>()

// 头像候选:uid 动态解析优先,静态地址兜底;全部加载失败回落音符图标
const candidates = computed(() => avatarCandidates(props))
const failedCount = ref(0)
watch(() => `${props.uid ?? ''}|${props.avatar ?? ''}`, () => (failedCount.value = 0))
const src = computed(() => candidates.value[failedCount.value] ?? '')

// 静态头像垫底:动态解析请求期间显示,加载完成后被 img 内容覆盖
const fallbackBg = computed(() => avatarFallbackBg(props.avatar))
</script>

<template>
  <component
    :is="props.href ? 'a' : 'div'"
    :href="props.href"
    :target="props.href ? '_blank' : undefined"
    :rel="props.href ? 'noopener noreferrer' : undefined"
    :title="props.href ? '进入直播间' : undefined"
    class="block cursor-pointer transition-opacity duration-200 hover:opacity-80"
  >
    <div class="flex-center p-8px">
      <div
        class="relative w-140px h-140px rounded-full border-3 border-brand-light flex-center animate-disc motion-reduce:animate-none"
      >
        <div
          class="w-110px h-110px rounded-full bg-brand-soft border-4 border-bg-card flex-center overflow-hidden bg-cover bg-center"
          :style="fallbackBg ? { backgroundImage: fallbackBg } : undefined"
        >
          <img
            v-if="src"
            :src="src"
            class="w-full h-full rounded-full object-cover"
            alt="主播头像"
            referrerpolicy="no-referrer"
            @error="failedCount++"
          />
          <div v-else class="i-carbon-music text-36px text-brand"></div>
        </div>
        <div class="absolute top-8px left-1/2 -translate-x-1/2 w-10px h-10px rounded-full bg-brand"></div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.animate-disc {
  animation: disc-spin 12s linear infinite;
}
@keyframes disc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
