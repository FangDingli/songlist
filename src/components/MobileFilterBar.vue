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
// 展开/收起带 max-height 过渡:收起高度为实测单行高,展开高度为实测换行总高
const expanded = ref(false)
const overflow = ref(false)
const listEl = ref<HTMLElement | null>(null)
const rowH = ref(0) // 收起态单行高(实测缓存,展开态测不到)
const animTimer: ReturnType<typeof setTimeout>[] = []

function checkOverflow() {
  if (expanded.value) return
  // 顺手缓存收起态行高(展开动画的收缩目标)
  if (listEl.value) rowH.value = listEl.value.getBoundingClientRect().height
  overflow.value = !!listEl.value && listEl.value.scrollWidth > listEl.value.clientWidth + 1
}

/** 展开/收起动画:锁住当前高度 → 改变换行布局 → 实测目标高度 → 放开过渡 */
async function toggleExpand() {
  const el = listEl.value
  if (!el) return
  animTimer.forEach(clearTimeout)
  animTimer.length = 0
  if (!expanded.value) {
    // 展开:先切 flex-wrap 并锁在单行高,测出换行总高后过渡放开
    expanded.value = true
    el.style.maxHeight = `${rowH.value}px`
    await nextTick()
    const target = el.scrollHeight
    requestAnimationFrame(() => { el.style.maxHeight = `${target}px` })
    animTimer.push(setTimeout(() => { el.style.maxHeight = '' }, 350))
  } else {
    // 收起:从换行总高过渡回单行高,结束后切回 nowrap 单行滚动
    el.style.maxHeight = `${el.scrollHeight}px`
    await nextTick()
    requestAnimationFrame(() => { el.style.maxHeight = `${rowH.value}px` })
    animTimer.push(setTimeout(async () => {
      expanded.value = false
      el.style.maxHeight = ''
      // 等 Vue 把布局切回 nowrap 后再测溢出,否则测到的是换行布局(无横向溢出)
      await nextTick()
      checkOverflow()
    }, 320))
  }
}

// tag 数量、视口宽度、展开/收起都会影响溢出判定
watch(() => props.tags, async () => { await nextTick(); checkOverflow() }, { deep: true })
onMounted(() => { checkOverflow(); window.addEventListener('resize', checkOverflow) })
onUnmounted(() => {
  window.removeEventListener('resize', checkOverflow)
  animTimer.forEach(clearTimeout)
})
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
          class="hide-scrollbar flex gap-6px pb-1px transition-[max-height] duration-300 ease-out"
          :class="expanded ? 'flex-wrap overflow-hidden' : 'overflow-x-auto'"
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
        @click="toggleExpand"
      >
        <div
          class="i-carbon-chevron-down text-12px transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
        ></div>
      </button>
    </div>
  </div>
</template>
