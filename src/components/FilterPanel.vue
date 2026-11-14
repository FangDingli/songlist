<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TagPill from './TagPill.vue'
import type { FilterTag } from '@/types'

const props = defineProps<{
  keyword: string
  tags: FilterTag[]
  selectedTag: { kind: FilterTag['kind']; name: string } | null
  total: number
  filteredCount: number
}>()

const emit = defineEmits<{
  (e: 'update:keyword', value: string): void
  (e: 'toggleTag', kind: FilterTag['kind'], name: string): void
  (e: 'shuffle'): void
  (e: 'random'): void
}>()

/* 窄屏 tag 折叠:tag 种类多的主播(shiro/xiu 29 种)全量换行铺开会占近半屏,
 * 默认只显示前 3 行,底部渐变提示 + 展开按钮;桌面侧栏(≥1024px)空间充足不折叠 */
const COLLAPSED_H = 106 // 3 行 tag(30px×3 + 间距 8px×2)
const expanded = ref(false)
const overflow = ref(false)
const listEl = ref<HTMLElement | null>(null)
const desktopMq =
  typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null

function checkOverflow() {
  if (desktopMq?.matches) {
    overflow.value = false
    return
  }
  overflow.value = !!listEl.value && listEl.value.scrollHeight > COLLAPSED_H + 1
}

// tag 数量、视口宽度都会影响折叠判定;选中 tag 时自动展开(方便看到选中上下文),取消后不强制收起
watch(() => props.tags, async () => { await nextTick(); checkOverflow() }, { deep: true })
watch(() => props.selectedTag, (v) => { if (v) expanded.value = true })
onMounted(() => {
  checkOverflow()
  desktopMq?.addEventListener('change', checkOverflow)
  window.addEventListener('resize', checkOverflow)
})
onUnmounted(() => {
  desktopMq?.removeEventListener('change', checkOverflow)
  window.removeEventListener('resize', checkOverflow)
})
</script>

<template>
  <div class="flex flex-col gap-14px">
    <div class="relative">
      <div
        class="i-carbon-search absolute left-14px top-1/2 -translate-y-1/2 text-brand text-16px pointer-events-none"
      ></div>
      <input
        type="search"
        :value="keyword"
        placeholder="搜索歌名、歌手..."
        class="w-full h-44px px-14px pl-40px rounded-xl bg-[rgb(var(--bg-base))] text-14px text-text-primary outline-none transition-shadow duration-200 placeholder:text-text-secondary focus:shadow-[0_0_0_2px_rgb(var(--brand)/0.4)]"
        @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="flex gap-10px">
      <button type="button" class="btn-soft flex-1" @click="emit('shuffle')">
        <div class="i-carbon-shuffle text-15px"></div>
        打乱顺序
      </button>
      <button type="button" class="btn-soft flex-1" @click="emit('random')">
        <div class="i-carbon-face-add text-15px"></div>
        随机点歌
      </button>
    </div>

    <p class="text-12px text-text-secondary">
      {{ filteredCount === total ? `共 ${total} 首` : `筛选出 ${filteredCount} / ${total} 首` }}
    </p>

    <div>
      <div class="relative">
        <div
          ref="listEl"
          class="flex flex-wrap gap-8px"
          :style="!expanded && overflow ? { maxHeight: `${COLLAPSED_H}px`, overflow: 'hidden' } : undefined"
        >
          <TagPill
            v-for="tag in tags"
            :key="tag.kind + tag.name"
            :label="tag.name"
            :count="tag.count"
            :selected="!!selectedTag && selectedTag.kind === tag.kind && selectedTag.name === tag.name"
            @toggle="emit('toggleTag', tag.kind, tag.name)"
          />
        </div>
        <!-- 收起时被裁断的行用渐变隐去,提示下方还有更多 -->
        <div
          v-if="!expanded && overflow"
          class="pointer-events-none absolute left-0 right-0 bottom-0 h-28px bg-gradient-to-t from-[rgb(var(--bg-card))] to-transparent"
        ></div>
      </div>
      <button
        v-if="overflow"
        type="button"
        class="mt-6px flex items-center gap-4px text-12px text-brand-strong cursor-pointer"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起标签' : `展开全部标签(${tags.length})` }}
        <div
          class="i-carbon-chevron-down text-12px transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
        ></div>
      </button>
    </div>
  </div>
</template>
