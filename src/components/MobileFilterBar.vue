<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TagPill from './TagPill.vue'
import type { FilterTag } from '@/types'

const props = defineProps<{
  keyword: string
  tags: FilterTag[]
  selectedTag: { kind: FilterTag['kind']; name: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:keyword', value: string): void
  (e: 'toggleTag', kind: FilterTag['kind'], name: string): void
}>()

// 收起态单行横向滚动(保留滑动);溢出时右侧显示箭头,点击换行展开全部
const expanded = ref(false)
const overflow = ref(false)
const listEl = ref<HTMLElement | null>(null)

function checkOverflow() {
  if (expanded.value) return
  overflow.value = !!listEl.value && listEl.value.scrollWidth > listEl.value.clientWidth + 1
}

// tag 数量、视口宽度、展开/收起都会影响溢出判定
watch(() => props.tags, async () => { await nextTick(); checkOverflow() }, { deep: true })
watch(expanded, async (v) => { if (!v) { await nextTick(); checkOverflow() } })
onMounted(() => { checkOverflow(); window.addEventListener('resize', checkOverflow) })
onUnmounted(() => window.removeEventListener('resize', checkOverflow))
</script>

<template>
  <!-- 移动端吸顶紧凑条:小搜索框 + 不带数量的 tag,横向滚动,尽量少占空间 -->
  <div class="px-12px py-8px">
    <div class="relative">
      <div
        class="i-carbon-search absolute left-10px top-1/2 -translate-y-1/2 text-brand text-14px pointer-events-none"
      ></div>
      <input
        type="search"
        :value="keyword"
        placeholder="搜索歌名、歌手..."
        class="w-full h-36px px-10px pl-30px rounded-lg bg-[rgb(var(--bg-base))] text-13px text-text-primary outline-none transition-shadow duration-200 placeholder:text-text-secondary focus:shadow-[0_0_0_2px_rgb(var(--brand)/0.4)]"
        @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <!-- 箭头独立占位(flex 行),不覆盖 tag;收起且溢出时右缘渐变提示可滚动 -->
    <div class="mt-8px flex items-center gap-4px">
      <div class="relative min-w-0 flex-1">
        <div
          ref="listEl"
          class="hide-scrollbar flex gap-6px pb-1px"
          :class="expanded ? 'flex-wrap' : 'overflow-x-auto'"
        >
          <TagPill
            v-for="tag in tags"
            :key="tag.kind + tag.name"
            class="shrink-0"
            :label="tag.name"
            :selected="!!selectedTag && selectedTag.kind === tag.kind && selectedTag.name === tag.name"
            @toggle="emit('toggleTag', tag.kind, tag.name)"
          />
        </div>
        <div
          v-if="!expanded && overflow"
          class="pointer-events-none absolute right-0 top-0 bottom-0 w-16px bg-gradient-to-l from-[rgb(var(--bg-card)/0.95)] to-transparent"
        ></div>
      </div>
      <button
        v-if="overflow || expanded"
        type="button"
        class="shrink-0 w-24px h-24px rounded-full bg-[rgb(var(--bg-card)/0.92)] shadow-[0_1px_6px_rgb(0_0_0/0.18)] flex-center text-text-secondary"
        :title="expanded ? '收起' : '展开全部'"
        @click="expanded = !expanded"
      >
        <div
          class="i-carbon-chevron-down text-12px transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
        ></div>
      </button>
    </div>
  </div>
</template>
