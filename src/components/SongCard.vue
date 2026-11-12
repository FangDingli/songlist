<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Song } from '@/types'
import { songTags } from '@/utils/songs'

const props = defineProps<{
  song: Song
  /** 展示编号:当前列表顺序中的序号(从 1 开始),与歌曲 id 解耦,防止观众记住编号映射 */
  no: number
  highlighted?: boolean
  /** 卡片实际宽度(px,由虚拟滚动按容器宽与列数算出);0 表示首帧尚未测量 */
  cardWidth?: number
}>()

const emit = defineEmits<{
  (e: 'order', song: Song): void
}>()

/** 付费标记文案:优先 paid(「30SC」「舰长」等),兼容 qylive 的 sc 数值 */
const paidLabel = computed(() => props.song.paid ?? (props.song.sc ? `${props.song.sc} SC` : ''))
const hasPaid = computed(() => !!paidLabel.value)

/** 歌曲直播切片(B 站视频 BV 号),有才显示跳转图标 */
const videoUrl = computed(() => {
  const bv = props.song.video?.trim()
  return bv ? `https://www.bilibili.com/video/${bv}` : ''
})

/** 备注原文:桌面 hover 展开面板 / 触屏点角标切换,面板悬浮不占布局高度 */
const remark = computed(() => props.song.remark?.trim() ?? '')
const remarkOpen = ref(false)

function order() {
  remarkOpen.value = false
  emit('order', props.song)
}

/** 分类 tag 配色,从预设色板的浅色底 + 深色字组合中按 key 稳定取色 */
const TAG_PALETTE = [
  { bg: '#E6F4FF', fg: '#0958D9' }, // blue
  { bg: '#F9F0FF', fg: '#722ED1' }, // purple
  { bg: '#E6FFFB', fg: '#08979C' }, // cyan
  { bg: '#F6FFED', fg: '#389E0D' }, // green
  { bg: '#FFF0F6', fg: '#C41D7F' }, // magenta
  { bg: '#FFF7E6', fg: '#D46B08' }, // orange
  { bg: '#FFFBE6', fg: '#D48806' }, // gold
  { bg: '#F0F5FF', fg: '#1D39C4' }, // geekblue
]

function colorOf(key: string) {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

function colorStyle(key: string) {
  const c = colorOf(key)
  return { backgroundColor: c.bg, color: c.fg }
}

/**
 * 展示 tag(genre 拆分结果)。原先「全部渲染 + overflow-hidden 硬裁」会在窄卡上
 * 把最后一个 tag 切成半截(桌面 5 列时卡片仅约 257px,比手机单列还窄)。
 * 现在改为:按卡片实际宽度只渲染能完整放下的 tag,放不下的折成「+N」,
 * 完整列表放在 title 里。宽度由 App.vue 传入(网格等宽列),纯计算不测 DOM,
 * 虚拟滚动下零额外开销;tag 区再以整行换行裁切做兜底,杜绝半截 tag。
 */
const allTags = computed(() => songTags(props.song))

const MAX_TAGS = 8 // 防御异常数据(一首歌几十个 tag),正常歌单达不到
const CARD_INSET = 38 // song-card 左右各 p-18px + 1px 边框
const ROW_GAP = 8 // 第二行 items 的 gap-8px
const TAG_GAP = 6 // tag 之间的 gap-6px
const TAG_PAD = 16 // song-tag 的 px-8px
const MORE_W = 34 // 「+N」徽标预留宽度

/** 估算单个 tag 宽度:中文按 12.5px/字、其余按 7.5px/字,再留 2px 余量 */
function tagWidth(tag: string) {
  let w = 0
  for (const ch of tag) w += /[^\x00-\xff]/.test(ch) ? 12.5 : 7.5
  return Math.ceil(w + TAG_PAD + 2)
}

const tagLayout = computed(() => {
  const all = allTags.value
  const w = props.cardWidth ?? 0
  // 宽度未知(首帧)时保守只放 2 个,并给一个窄上限,由 CSS 整行裁切兜底
  if (!w) return { tags: all.slice(0, 2), rest: Math.max(0, all.length - 2), maxWidth: 100 }

  const inner = Math.max(0, w - CARD_INSET)
  const fit = (budget: number) => {
    let used = 0
    let n = 0
    for (const tag of all.slice(0, MAX_TAGS)) {
      const tw = tagWidth(tag) + (n ? TAG_GAP : 0)
      if (used + tw > budget) break
      used += tw
      n++
    }
    return n
  }
  // 全部放得下就不显示 +N(手机单列保持原来的完整展示)
  const plainBudget = inner - ROW_GAP
  if (fit(plainBudget) === all.length) {
    return { tags: all, rest: 0, maxWidth: Math.max(0, plainBudget) }
  }
  // 放不下:扣掉两处行间距与徽标宽度后重算,只留完整 tag
  const budget = inner - ROW_GAP * 2 - MORE_W
  const n = fit(budget)
  return { tags: all.slice(0, n), rest: all.length - n, maxWidth: Math.max(0, budget) }
})
</script>

<template>
  <!-- 根节点用 div(role=button)而非 button:卡片内需容纳视频链接、备注角标等交互元素,button 不允许嵌套 -->
  <div
    class="song-card sc-root"
    :class="{ 'border-[rgb(var(--error)/0.45)]': hasPaid, 'remark-open': remarkOpen }"
    :data-song-id="song.id"
    role="button"
    tabindex="0"
    @click="order"
    @keydown.enter.prevent="order"
  >
    <!-- 大编号水印 -->
    <span
      class="absolute right-16px top-6px text-52px lh-1 font-900 select-none pointer-events-none text-[rgb(var(--text-primary)/0.06)]"
    >
      {{ String(no).padStart(2, '0') }}
    </span>

    <!-- hover 复制提示遮罩(圆角自裁:卡片本身没有 overflow-hidden,给 remark 面板让路) -->
    <span
      class="card-overlay absolute inset-0 rounded-2xl flex-center bg-[rgb(var(--brand)/0.15)] backdrop-blur-2px"
    >
      <span class="text-brand-strong font-bold text-sm">点击复制点歌口令</span>
    </span>

    <div class="relative z-10">
      <div class="flex items-center justify-between gap-8px">
        <h3 class="min-w-0 text-16px lh-24px font-bold text-text-primary truncate" :title="song.title">
          {{ song.title }}
        </h3>
      <div class="shrink-0 flex items-center gap-6px">
        <span v-if="song.lang" class="text-13px font-bold text-brand-strong tracking-wide">{{ song.lang }}</span>
        <span v-if="paidLabel" class="text-12px font-bold text-error" :title="`付费点歌:${paidLabel}`">
          {{ paidLabel }}
        </span>
        <!-- 歌曲切片:新开 B 站视频;stop 防止触发复制口令 -->
        <a
          v-if="videoUrl"
          :href="videoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-text-secondary hover:text-brand-strong transition-colors"
          title="观看歌曲切片"
          @click.stop
        >
          <span class="i-carbon-play text-14px block"></span>
        </a>
        <!-- 备注角标:仅触屏设备显示(桌面端 hover 直接展开面板) -->
        <button
          v-if="remark"
          type="button"
          class="remark-badge text-text-secondary"
          :title="`备注:${remark}`"
          @click.stop="remarkOpen = !remarkOpen"
        >
          <span class="i-carbon-information text-14px block"></span>
        </button>
      </div>
      </div>
      <!-- 只渲染放得下的整 tag,剩余折成 +N;tag 区固定单行高度换行裁切,绝不出现半截 tag -->
      <div class="mt-8px flex items-center gap-8px min-w-0 overflow-hidden">
        <p class="min-w-0 flex-1 text-13px text-text-secondary truncate" :title="song.singer">{{ song.singer }}</p>
        <div
          class="shrink-0 flex items-center justify-end flex-wrap gap-6px h-20px overflow-hidden"
          :style="{ maxWidth: `${tagLayout.maxWidth}px` }"
          :title="allTags.join('、')"
        >
          <span v-for="tag in tagLayout.tags" :key="tag" class="song-tag shrink-0" :style="colorStyle(tag)">
            {{ tag }}
          </span>
        </div>
        <span
          v-if="tagLayout.rest"
          class="song-tag shrink-0 bg-[rgb(var(--text-primary)/0.06)] text-text-secondary"
          :title="`全部类型:${allTags.join('、')}`"
        >
          +{{ tagLayout.rest }}
        </span>
      </div>
    </div>

    <!-- 随机点歌命中的呼吸描边 -->
    <span
      v-if="highlighted"
      class="absolute inset-0 rounded-2xl border-2 border-brand pointer-events-none animate-ping-slow"
    ></span>

    <!-- 备注面板:贴卡片底边向下延伸(无缝隙,hover 不中断),悬浮覆盖下一行,不占布局高度 -->
    <div v-if="remark" class="sc-remark">{{ remark }}</div>
  </div>
</template>

<style scoped>
.card-overlay {
  opacity: 0;
  transition: opacity 0.2s var(--ease-out);
}
.sc-root:hover .card-overlay {
  opacity: 1;
}

/* div 替代 button 后补回键盘焦点样式 */
.sc-root:focus-visible {
  outline: 2px solid rgb(var(--brand));
  outline-offset: 2px;
}

/* remark 面板:默认隐藏;展开时悬浮在下一行上方,提升 z-index 压过 DOM 靠后的行 */
.sc-remark {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 10px 16px 12px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(var(--text-secondary));
  background: rgb(var(--bg-card));
  border: 1px solid rgb(var(--border));
  border-top: 0;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  pointer-events: none;
  word-break: break-word;
  transition:
    opacity 0.15s var(--ease-out),
    transform 0.15s var(--ease-out),
    visibility 0.15s;
}
.sc-root.remark-open {
  z-index: 30;
}
.sc-root.remark-open .sc-remark {
  opacity: 1;
  visibility: visible;
  transform: none;
  pointer-events: auto;
}

/* 有鼠标的设备:hover 展开,角标隐藏 */
@media (hover: hover) {
  .sc-root:hover {
    z-index: 30;
  }
  .sc-root:hover .sc-remark {
    opacity: 1;
    visibility: visible;
    transform: none;
    pointer-events: auto;
  }
  .remark-badge {
    display: none;
  }
}

.animate-ping-slow {
  animation: ping-slow 1.2s var(--ease-out) infinite;
}
@keyframes ping-slow {
  0% {
    opacity: 0.9;
  }
  70%,
  100% {
    opacity: 0;
  }
}
</style>
