<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { useElementSize, useWindowSize, useWindowScroll } from '@vueuse/core'
import configRaw from '@/data/qiyuan-config.json?raw'
import songsRaw from '@/data/qiyuan-songs.json?raw'
import type { FilterTag, Song, StreamerMeta } from '@/types'
import { DATA_BASE_URL, DEFAULT_STREAMER_ID, FALLBACK_META, dataUrl, formatOrder } from '@/config'
import { getStreamerId } from '@/utils/streamer'
import { applyStreamerTheme } from '@/utils/theme'
import { songTags, withIds } from '@/utils/songs'
import SongCard from '@/components/SongCard.vue'
import LandingPage from '@/components/LandingPage.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import MobileFilterBar from '@/components/MobileFilterBar.vue'
import QrModal from '@/components/QrModal.vue'
import RotatingDisc from '@/components/RotatingDisc.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useToast } from '@/composables/useToast'
import { useTheme } from '@/composables/useTheme'
import { avatarCandidates, avatarFallbackBg, resolveAvatar } from '@/utils/avatar'

const { copy } = useClipboard()
const { toasts, show } = useToast()
const { mode, resolved, cycleMode } = useTheme()

/* ---------- 主播识别与数据加载 ---------- */
const streamerId = ref<string | null>(getStreamerId())
// 根路径渲染系统介绍页
const isLanding = computed(() => streamerId.value === null)
const meta = ref<StreamerMeta>({ ...FALLBACK_META })
const songs = shallowRef<Song[]>([])
// ready:数据就绪;loading:非默认主播拉取中;not-found:该主播没有数据
const dataStatus = ref<'loading' | 'ready' | 'not-found'>('loading')
// 数据更新日期来自主播配置(meta.songsUpdatedAt),由转换脚本写入
const updatedAt = computed(() => meta.value.songsUpdatedAt ?? '')

// 移动端顶栏头像:uid 动态解析优先,静态地址兜底,全部失败回落音符图标
const barAvatarCandidates = computed(() => avatarCandidates(meta.value))
const barAvatarFailed = ref(0)
watch(() => `${meta.value.uid ?? ''}|${meta.value.avatar ?? ''}`, () => (barAvatarFailed.value = 0))
const barAvatarSrc = computed(() => barAvatarCandidates.value[barAvatarFailed.value] ?? '')

// 默认主播使用打包内置数据,首屏零等待
if (streamerId.value === DEFAULT_STREAMER_ID) {
  meta.value = { ...FALLBACK_META, ...(JSON.parse(configRaw) as StreamerMeta) }
  songs.value = withIds(JSON.parse(songsRaw))
  dataStatus.value = 'ready'
}

/** 拉取 json:配置了数据源时优先,404/网络失败回落同源仓库文件(兜底) */
async function fetchJson(path: string): Promise<unknown | null> {
  if (DATA_BASE_URL) {
    try {
      const res = await fetch(dataUrl(path), { cache: 'no-cache' })
      // await 让 json() 的解析失败(如 SPA 回退返回 HTML)也落入本函数的 catch,
      // 裸 return res.json() 会把拒绝漏给调用方
      if (res.ok) return await res.json()
    } catch {
      /* 数据源不可达,回落同源 */
    }
  }
  try {
    const res = await fetch(path, { cache: 'no-cache' })
    if (res.ok) return await res.json()
  } catch {
    /* 同源也失败 */
  }
  return null
}

async function loadStreamerData() {
  if (isLanding.value) return
  let id = streamerId.value as string

  // 配置:数据源/仓库均 404 时,查入驻清单的别名(如中文路径)反查真实 id
  let config = (await fetchJson(`/streamers/${id}/config.json`)) as StreamerMeta | null
  if (!config) {
    const manifest = (await fetchJson('/streamers.json')) as Array<{ id: string; config: StreamerMeta }> | null
    const hit = manifest?.find((s) =>
      s.config.aliases?.some((a) => a.trim().toLowerCase() === id.toLowerCase()),
    )
    if (hit) {
      id = hit.id
      streamerId.value = id // 展示与二维码使用真实 id,URL 保持别名不变
      config = hit.config
    }
  }
  if (!config) {
    if (dataStatus.value !== 'ready') dataStatus.value = 'not-found'
    return
  }
  meta.value = { ...FALLBACK_META, ...config }

  // 歌曲:配置拿到了再拉,避免无效请求;两步任一失败按「没有找到主播」处理
  const songsRaw = await fetchJson(`/streamers/${id}/songs.json`)
  if (!songsRaw) {
    if (dataStatus.value !== 'ready') dataStatus.value = 'not-found'
    return
  }
  try {
    songs.value = withIds(songsRaw)
    dataStatus.value = 'ready'
  } catch {
    if (dataStatus.value !== 'ready') dataStatus.value = 'not-found'
  }
}

onMounted(loadStreamerData)

watchEffect(() => {
  document.title = isLanding.value ? '省心的主播歌单展示' : meta.value.title
})

// 主题色随主播配置与亮暗模式联动
watchEffect(() => applyStreamerTheme(meta.value.theme, resolved.value === 'dark'))


/* ---------- 虚拟滚动常量(行高需与 song-card 的 h-90px + 间距一致) ---------- */
const CARD_H = 90
const GAP = 16
const ROW_H = CARD_H + GAP
const CARD_MIN_W = 240
const OVERSCAN = 3
const MOBILE_BAR_TOP = 52 // 移动端吸顶栏高度

const themeIcon = computed(() =>
  mode.value === 'auto' ? 'i-carbon-contrast' : mode.value === 'light' ? 'i-carbon-sun' : 'i-carbon-moon',
)
const themeTitle = computed(() =>
  mode.value === 'auto' ? '主题:跟随系统(点击切换为亮色)' : mode.value === 'light' ? '主题:亮色(点击切换为暗色)' : '主题:暗色(点击切换为跟随系统)',
)

const keyword = ref('')
// 单选筛选:全局最多选中一个 tag,再点同款取消,点其他替换
const selectedTag = ref<{ kind: FilterTag['kind']; name: string } | null>(null)

// 打乱:每次点击重新生成一次全量随机序,之后随筛选增删顺序保持稳定
const shuffled = ref(false)
const randomRank = ref(new Map<number, number>())
// 打乱动画:网格短暂进入 shuffling 状态,卡片带错峰抖动入场
const shuffling = ref(false)
let shuffleTimer: ReturnType<typeof setTimeout> | undefined

const highlightId = ref<number | null>(null)

/** 统计维度取值及数量,按数量降序 */
function countBy(get: (s: Song) => string | string[]): Array<[string, number]> {
  const counter = new Map<string, number>()
  for (const song of songs.value) {
    const keys = get(song)
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      counter.set(key, (counter.get(key) ?? 0) + 1)
    }
  }
  return [...counter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
}

const languages = computed(() => countBy((s) => s.lang).filter(([name]) => name))
const genres = computed(() => countBy((s) => songTags(s)))

/** 是否付费/SC 歌曲:「付费」「免费」筛选与计数共用 */
const isPaid = (s: Song) => !!s.paid || (!!s.sc && Number(s.sc) > 0)
const paidCount = computed(() => songs.value.filter(isPaid).length)

const tags = computed(() => [
  ...languages.value.map(([name, count]) => ({ name, count, kind: 'language' as const })),
  ...genres.value.map(([name, count]) => ({ name, count, kind: 'genre' as const })),
  // 有歌曲需要付费/SC 时,「付费」「免费」成对展示
  ...(paidCount.value
    ? [
        { name: '付费', count: paidCount.value, kind: 'paid' as const },
        { name: '免费', count: songs.value.length - paidCount.value, kind: 'free' as const },
      ]
    : []),
])

/** 歌名/歌手包含匹配 */
function matchKeyword(song: Song, kw: string): boolean {
  return song.title.toLowerCase().includes(kw) || song.singer.toLowerCase().includes(kw)
}

const filtered = computed(() => {
  // 先按 tag 筛选并应用随机序,得到「当前编号」;编号搜索按此编号匹配
  const sel = selectedTag.value
  const byTag = songs.value.filter((song) => {
    if (!sel) return true
    if (sel.kind === 'language') return song.lang === sel.name
    if (sel.kind === 'genre') return songTags(song).includes(sel.name)
    if (sel.kind === 'paid') return isPaid(song)
    return !isPaid(song)
  })
  const ordered = shuffled.value
    ? [...byTag].sort((a, b) => (randomRank.value.get(a.id) ?? 0) - (randomRank.value.get(b.id) ?? 0))
    : byTag

  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return ordered
  // 纯数字(≤4 位):同时匹配「当前列表编号」与歌名/歌手,输入 18 即点 18 号
  if (/^\d{1,4}$/.test(kw)) {
    const no = Number(kw)
    return ordered.filter((song, i) => i + 1 === no || matchKeyword(song, kw))
  }
  return ordered.filter((song) => matchKeyword(song, kw))
})

const hasActiveFilters = computed(() => keyword.value.trim() !== '' || selectedTag.value !== null)

function toggleTag(kind: FilterTag['kind'], name: string) {
  const cur = selectedTag.value
  selectedTag.value = cur && cur.kind === kind && cur.name === name ? null : { kind, name }
}

function clearFilters() {
  keyword.value = ''
  selectedTag.value = null
}

function shuffle() {
  const ids = songs.value.map((s) => s.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  randomRank.value = new Map(ids.map((id, idx) => [id, idx]))
  shuffled.value = true
  // 瞬时回顶:列表整体换血,平滑滚动反而拖沓
  window.scrollTo(0, 0)
  // 播放一轮错峰抖动动画,表现随机感
  shuffling.value = true
  clearTimeout(shuffleTimer)
  shuffleTimer = setTimeout(() => (shuffling.value = false), 900)
}

async function orderSong(song: Song) {
  const text = formatOrder(song, meta.value)
  const ok = await copy(text)
  show(ok ? `已复制:${text}` : '复制失败,请手动复制', ok ? 'success' : 'error')
}

/* ---------- 窗口级虚拟滚动:把列表按列数切块成行,只渲染视口附近的行 ---------- */
const mainEl = ref<HTMLElement | null>(null)
const { width: mainW } = useElementSize(mainEl)
const { y: scrollY } = useWindowScroll()
const { height: winH } = useWindowSize()

const cols = computed(() => {
  const w = mainW.value
  if (!w) return 4
  return Math.min(5, Math.max(1, Math.floor((w + GAP) / (CARD_MIN_W + GAP))))
})

const rows = computed(() => {
  const list = filtered.value
  const out: Song[][] = []
  for (let i = 0; i < list.length; i += cols.value) out.push(list.slice(i, i + cols.value))
  return out
})

const gridRef = ref<HTMLElement | null>(null)

const firstVisible = computed(() => {
  void rows.value.length
  void cols.value
  // 读取滚动位置建立响应式依赖:滚动时重算可视行
  void scrollY.value
  const el = gridRef.value
  if (!el) return 0
  const scrolled = -el.getBoundingClientRect().top
  const raw = Math.floor(scrolled / ROW_H) - OVERSCAN
  return Math.max(0, Math.min(raw, rows.value.length - 1))
})

const visibleRows = computed(() => {
  const count = Math.ceil(winH.value / ROW_H) + OVERSCAN * 2 + 1
  return rows.value.slice(firstVisible.value, firstVisible.value + count)
})

async function randomPick() {
  const pool = filtered.value
  if (!pool.length) {
    show('当前筛选条件下没有歌曲', 'error')
    return
  }
  const song = pool[Math.floor(Math.random() * pool.length)]
  const ok = await copy(formatOrder(song, meta.value))
  show(ok ? `选中《${song.title}》,口令已复制` : '复制失败,请手动复制', ok ? 'success' : 'error')
  highlightId.value = song.id
  setTimeout(() => {
    if (highlightId.value === song.id) highlightId.value = null
  }, 4000)
}

const showBackTop = computed(() => scrollY.value > winH.value * 0.6)

// 二维码:内容为当前主播页的完整地址
const showQr = ref(false)
const qrUrl = computed(() => `${location.origin}/${streamerId.value}`)

// 站点 favicon:优先主播配置,缺省动态解析/头像,都没有则保留默认音符图标
watchEffect(() => {
  const href = meta.value.favicon || resolveAvatar(meta.value)
  if (!href) return
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
})

/* ---------- 移动端紧凑筛选条:滚过原面板且向上滑动时出现 ---------- */
const mobilePanelRef = ref<HTMLElement | null>(null)
const lastScrollY = ref(0)
const scrollingUp = ref(false)

watch(scrollY, (y) => {
  const delta = y - lastScrollY.value
  if (Math.abs(delta) > 2) scrollingUp.value = delta < 0
  lastScrollY.value = y
})

const mobilePanelOutOfView = computed(() => {
  void scrollY.value
  const el = mobilePanelRef.value
  return el ? el.getBoundingClientRect().bottom < MOBILE_BAR_TOP : false
})

const showMobileBar = computed(() => mobilePanelOutOfView.value && scrollingUp.value)

function backToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** 侧栏与页脚的数据说明:拉取过远端才显示更新日期 */
const dataMeta = computed(
  () => (updatedAt.value ? `数据更新于 ${updatedAt.value} · ` : '') + `共 ${songs.value.length} 首`,
)
</script>

<template>
  <!-- 固定背景层:position:fixed 不随页面滚动。背景图来自主播 meta 配置 -->
  <div class="fixed inset-0 -z-10 bg-bg-base" aria-hidden="true">
    <img v-if="meta.bg?.mobile" :src="meta.bg.mobile" class="w-full h-full object-cover lg:hidden" alt="" />
    <img v-if="meta.bg?.desktop" :src="meta.bg.desktop" class="hidden w-full h-full object-cover lg:block" alt="" />
    <div class="absolute inset-0 bg-[rgb(var(--bg-scrim)/var(--bg-scrim-a))] backdrop-blur-4px"></div>
  </div>

  <LandingPage v-if="isLanding" />

  <div v-else class="min-h-screen">
    <!-- 移动端吸顶栏 -->
    <div class="lg:hidden sticky top-0 z-50 bg-[rgb(var(--bg-card)/0.9)] backdrop-blur-xl border-b border-border">
        <div class="flex items-center justify-between gap-12px px-16px h-52px">
          <div class="flex items-center gap-8px min-w-0">
            <!-- 头像优先(随唱片机节奏旋转),静态头像垫底显示,动态加载失败逐级降级,全失败回落音符图标 -->
            <img v-if="barAvatarSrc" :src="barAvatarSrc" alt="" referrerpolicy="no-referrer"
              class="bar-avatar w-28px h-28px rounded-full object-cover shrink-0 bg-cover bg-center"
              :style="{ backgroundImage: avatarFallbackBg(meta.avatar) }" @error="barAvatarFailed++" />
            <div v-else class="i-carbon-music text-brand text-18px shrink-0"></div>
            <h1 class="text-17px lh-24px font-bold text-text-primary truncate">{{ meta.title }}</h1>
          <span v-if="dataStatus === 'ready'" class="shrink-0 text-12px text-text-secondary">共 {{ songs.length }}
            首</span>
        </div>
        <button type="button" class="theme-toggle shrink-0" :title="themeTitle" @click="cycleMode">
          <div :class="themeIcon"></div>
        </button>
      </div>
    </div>

    <div class="max-w-1720px mx-auto flex gap-24px p-16px md:p-24px">
      <!-- 桌面侧栏 -->
      <aside v-if="dataStatus === 'ready'" class="hidden lg:block w-300px shrink-0">
        <div class="sticky top-24px flex flex-col gap-24px">
          <div class="surface-card p-24px relative flex flex-col items-center">
            <button type="button" class="theme-toggle absolute top-16px right-56px z-10" title="生成二维码"
              @click="showQr = true">
              <div class="i-carbon-qr-code"></div>
            </button>
            <button type="button" class="theme-toggle absolute top-16px right-16px" :title="themeTitle"
              @click="cycleMode">
              <div :class="themeIcon"></div>
            </button>
            <RotatingDisc :avatar="meta.avatar" :uid="meta.uid" :href="meta.liveUrl" />
            <h2 class="mt-12px text-18px lh-28px font-bold text-text-primary">{{ meta.title }}</h2>
            <p v-if="meta.subtitle" class="mt-8px text-13px text-text-secondary text-center px-8px">{{ meta.subtitle }}
            </p>
            <p class="mt-8px text-12px text-text-secondary">{{ dataMeta }}</p>
          </div>

          <div class="surface-card p-20px">
            <FilterPanel v-model:keyword="keyword" :tags="tags" :selected-tag="selectedTag" :total="songs.length"
              :filtered-count="filtered.length" @toggle-tag="toggleTag" @shuffle="shuffle" @random="randomPick" />
          </div>
        </div>
      </aside>

      <main ref="mainEl" class="flex-1 min-w-0">
        <!-- 移动端筛选区:普通文档流,滚出视口后由紧凑吸顶条接管 -->
        <div v-if="dataStatus === 'ready'" ref="mobilePanelRef" class="lg:hidden mb-16px surface-card p-16px">
          <FilterPanel v-model:keyword="keyword" :tags="tags" :selected-tag="selectedTag" :total="songs.length"
            :filtered-count="filtered.length" @toggle-tag="toggleTag" @shuffle="shuffle" @random="randomPick" />
        </div>

        <!-- 主播不存在 -->
        <div v-if="dataStatus === 'not-found'" class="surface-card py-64px text-center">
          <p class="text-40px lh-none">🔍</p>
          <p class="mt-16px text-16px font-bold text-text-primary">没有找到主播「{{ streamerId }}」</p>
          <p class="mt-8px text-13px text-text-secondary">检查一下网址拼写,或返回首页查看已收录的主播</p>
          <a href="/"
            class="mt-16px inline-flex items-center h-36px px-16px rounded-xl bg-brand-soft text-brand-strong text-14px font-bold hover:opacity-80 transition-opacity">返回首页</a>
        </div>

        <template v-else-if="dataStatus === 'ready'">
          <!-- 移动端紧凑筛选条:向下滚动隐藏,向上滑动出现 -->
          <Transition name="bar">
            <div v-if="showMobileBar"
              class="lg:hidden fixed left-0 right-0 z-40 bg-[rgb(var(--bg-card)/0.95)] backdrop-blur-xl border-b border-border"
              :style="{ top: `${MOBILE_BAR_TOP}px` }">
              <MobileFilterBar v-model:keyword="keyword" :tags="tags" :selected-tag="selectedTag"
                @toggle-tag="toggleTag" />
            </div>
          </Transition>

          <!-- 虚拟滚动网格:外层撑起总高度,内层按滚动位置平移 -->
          <div ref="gridRef" class="relative" :class="{ 'grid-shuffling': shuffling }"
            :style="{ height: `${rows.length * ROW_H}px` }">
            <div class="absolute left-0 right-0 top-0" :style="{ transform: `translateY(${firstVisible * ROW_H}px)` }">
              <div v-for="(row, ri) in visibleRows" :key="row[0].id" class="grid gap-16px mb-16px"
                :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
                <SongCard v-for="(song, ci) in row" :key="song.id"
                  v-bind="{ song, no: (firstVisible + ri) * cols + ci + 1, highlighted: song.id === highlightId, style: { '--i': (ri * 2 + ci) % 8 } }"
                  @order="orderSong" />
              </div>
            </div>
          </div>

          <div v-if="!filtered.length" class="surface-card py-64px text-center">
            <div class="i-carbon-music text-40px text-brand-light mx-auto"></div>
            <p class="mt-12px text-14px text-text-secondary">没有找到符合条件的歌曲</p>
            <button v-if="hasActiveFilters" type="button"
              class="mt-12px text-14px text-brand-strong font-bold bg-transparent border-none cursor-pointer hover:opacity-80"
              @click="clearFilters">
              清除筛选条件
            </button>
          </div>

          <footer class="text-center px-16px pt-8px pb-32px text-12px text-text-secondary">
            <p>
              UIUX:
              <a href="https://space.bilibili.com/94843915" target="_blank" rel="noopener noreferrer"
                class="text-brand-strong hover:underline underline-offset-2px">来只奶茶</a>
              · 制作:
              <a href="https://space.bilibili.com/23598218" target="_blank" rel="noopener noreferrer"
                class="text-brand-strong hover:underline underline-offset-2px">归墟丶</a>
              · with GLM-5.3-Flash ·
              <a href="/" class="text-brand-strong hover:underline underline-offset-2px">关于本站</a>
            </p>
            <p class="mt-4px">{{ dataMeta }}</p>
          </footer>
        </template>

        <!-- 非默认主播数据加载中 -->
        <div v-if="dataStatus === 'loading'" class="surface-card py-64px text-center">
          <div class="i-carbon-music text-40px text-brand animate-pulse mx-auto"></div>
          <p class="mt-12px text-14px text-text-secondary">正在加载歌单…</p>
        </div>
      </main>
    </div>

    <!-- 回到顶部:滚动超过一屏后出现 -->
    <Transition name="toast">
      <button v-if="showBackTop && dataStatus === 'ready'" type="button" class="back-to-top" title="回到顶部"
        @click="backToTop">
        <div class="i-carbon-arrow-up"></div>
      </button>
    </Transition>

    <!-- 二维码弹窗:主播展示给观众扫码进入 -->
    <QrModal :open="showQr" :url="qrUrl" :logo="resolveAvatar(meta)" :logo-fallback="meta.avatar" :title="meta.title"
      @close="showQr = false" />

    <!-- Toast -->
    <div
      class="fixed bottom-24px left-1/2 -translate-x-1/2 z-100 flex flex-col items-center gap-8px pointer-events-none">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast"
          :class="t.type === 'error' ? 'bg-error' : 'bg-[rgba(0,0,0,0.85)]'">
          {{ t.text }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/* 移动端顶栏头像:与唱片机(RotatingDisc)同节奏旋转 */
.bar-avatar {
  animation: bar-disc-spin 12s linear infinite;
}
@keyframes bar-disc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bar-avatar {
    animation: none;
  }
}
</style>
