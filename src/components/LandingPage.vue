<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dataUrl } from '@/config'
import { useTheme } from '@/composables/useTheme'
import { avatarThumb, resolveAvatar } from '@/utils/avatar'
import type { StreamerMeta } from '@/types'

const { mode, cycleMode } = useTheme()

// 入驻清单来自数据源(streamers.json,发布脚本自动生成;未配置数据源时为同源文件);
// 拉取失败时隐藏板块
const listedStreamers = ref<Array<{ id: string; config: StreamerMeta }>>([])
onMounted(async () => {
  try {
    const res = await fetch(dataUrl('/streamers.json'), { cache: 'no-cache' })
    if (res.ok) listedStreamers.value = await res.json()
  } catch {
    /* 数据源不可达时隐藏入驻主播板块 */
  }
})

// 有标题的主播才算有效入驻(空目录/残缺配置不展示)
const validStreamers = computed(() => listedStreamers.value.filter((s) => s.config.title))

const themeIcon = computed(() =>
  mode.value === 'auto' ? 'i-carbon-contrast' : mode.value === 'light' ? 'i-carbon-sun' : 'i-carbon-moon',
)
const themeTitle = computed(() =>
  mode.value === 'auto' ? '主题:跟随系统(点击切换为亮色)' : mode.value === 'light' ? '主题:亮色(点击切换为暗色)' : '主题:暗色(点击切换为跟随系统)',
)

const painPoints = [
  '手动翻页,找歌全靠一篇篇翻',
  '下拉菜单筛选,操作繁琐',
  '页面塞满无关内容,喧宾夺主',
  '观众多用手机,却完全不为移动端优化',
  '滚动加载更多,性能问题治标不治本',
  '不支持暗黑模式',
]

const features = [
  { icon: 'i-carbon-wallet', title: '完全免费', desc: '不收费、不限量,所有功能开箱即用' },
  { icon: 'i-carbon-table', title: '维护方便', desc: '单个 Excel 即可完成歌单更新,零技术门槛' },
  { icon: 'i-carbon-color-palette', title: '个性化配置', desc: '主题色、背景图、口令格式,处处贴合主播风格' },
  { icon: 'i-carbon-gift', title: '盲盒点歌', desc: '编号随机展示防止背板,随缘点歌更有趣' },
  { icon: 'i-carbon-search', title: '搜索 + 标签筛选', desc: '即点即得,告别下拉菜单与手动翻页' },
  { icon: 'i-carbon-shuffle', title: '打乱顺序', desc: '一键重排歌单,每次进入都是新鲜感' },
  { icon: 'i-carbon-mobile', title: '移动端优先', desc: '响应式卡片网格与大触控目标,手机单手即用' },
  { icon: 'i-carbon-flash', title: '虚拟滚动', desc: '千首歌曲渲染压力恒定,滚动依旧流畅' },
  { icon: 'i-carbon-moon', title: '自动暗黑模式', desc: '跟随系统自动切换,也可以手动控制' },
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="w-full max-w-1080px mx-auto flex items-center justify-between px-16px h-64px">
      <div class="flex items-center gap-8px font-bold text-text-primary">
        <div class="i-carbon-music text-brand text-18px"></div>
        一个简单的歌单展示系统
      </div>
      <button type="button" class="theme-toggle" :title="themeTitle" @click="cycleMode">
        <div :class="themeIcon"></div>
      </button>
    </header>

    <main class="flex-1 w-full max-w-1080px mx-auto px-16px">
      <!-- Hero -->
      <section class="text-center pt-72px pb-56px">
        <h1 class="text-30px md:text-38px lh-46px font-600 text-text-primary">省心，纯粹，移动端优先的主播歌单展示</h1>
        <p class="mt-16px text-16px lh-24px text-text-secondary">不做别的，只做歌单展示</p>
        <div class="mt-32px flex justify-center gap-12px flex-wrap">
          <a
            href="/example"
            class="inline-flex items-center h-40px px-20px rounded-xl bg-brand text-white text-14px font-bold shadow-[0_4px_14px_rgb(var(--brand)/0.35)] hover:opacity-90 transition-opacity"
          >
            查看示例歌单 →
          </a>
          <a
            href="https://space.bilibili.com/23598218"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-soft"
          >B 站私信联系</a>
        </div>
      </section>

      <!-- 入驻主播 -->
      <section v-if="validStreamers.length" class="pb-56px">
        <h2 class="text-20px lh-28px font-600 text-center text-text-primary">入驻主播</h2>
        <p class="mt-8px text-center text-14px text-text-secondary">点击卡片进入对应歌单</p>
        <div class="mt-24px grid sm:grid-cols-2 lg:grid-cols-3 gap-12px">
          <a
            v-for="s in validStreamers"
            :key="s.id"
            :href="`/${s.id}`"
            class="surface-card p-20px flex items-center gap-16px transition-all duration-200 hover:shadow-[0_6px_20px_rgb(var(--brand)/0.2)] hover:-translate-y-2px"
          >
            <img
              v-if="resolveAvatar(s.config)"
              :src="avatarThumb(resolveAvatar(s.config))"
              class="w-56px h-56px rounded-full object-cover shrink-0"
              alt=""
              referrerpolicy="no-referrer"
            />
            <div v-else class="w-56px h-56px rounded-full bg-brand-soft text-brand text-24px flex-center shrink-0">
              <div class="i-carbon-music"></div>
            </div>
            <h3 class="min-w-0 text-15px font-bold text-text-primary truncate">
              {{ s.config.title || s.id }}
            </h3>
          </a>
        </div>
      </section>

      <!-- 痛点 -->
      <section class="pb-56px">
        <h2 class="text-20px lh-28px font-600 text-center text-text-primary">大多数歌单页,做得并不合格</h2>
        <p class="mt-8px text-center text-14px text-text-secondary">从一个专业前端开发的视角,这些问题随处可见</p>
        <div class="mt-24px grid sm:grid-cols-2 lg:grid-cols-3 gap-12px">
          <div
            v-for="point in painPoints"
            :key="point"
            class="surface-card p-16px flex items-start gap-10px"
          >
            <div class="i-carbon-close text-error text-16px shrink-0 mt-3px"></div>
            <p class="text-14px lh-22px text-text-secondary">{{ point }}</p>
          </div>
        </div>
      </section>

      <!-- 方案 -->
      <section class="pb-56px">
        <h2 class="text-20px lh-28px font-600 text-center text-text-primary">我们的答案</h2>
        <p class="mt-8px text-center text-14px text-text-secondary">解决上述问题的同时,还带来了更多</p>
        <div class="mt-24px grid sm:grid-cols-2 lg:grid-cols-3 gap-12px">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="surface-card p-20px"
          >
            <div class="w-36px h-36px rounded-lg bg-brand-soft text-brand-strong text-18px flex-center">
              <div :class="feature.icon"></div>
            </div>
            <h3 class="mt-12px text-15px font-bold text-text-primary">{{ feature.title }}</h3>
            <p class="mt-4px text-13px lh-20px text-text-secondary">{{ feature.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 使用流程 -->
      <section class="pb-56px">
        <h2 class="text-20px lh-28px font-600 text-center text-text-primary">四步,把你的歌单搬上来</h2>
        <p class="mt-8px text-center text-14px text-text-secondary">全程无需你懂技术,填好表格发给我就行</p>
        <div class="mt-24px grid sm:grid-cols-2 lg:grid-cols-4 gap-12px">
          <div class="surface-card p-20px relative">
            <span class="absolute top-8px right-16px text-28px font-900 text-[rgb(var(--brand)/0.15)] select-none">01</span>
            <div class="w-36px h-36px rounded-lg bg-brand-soft text-brand-strong text-18px flex-center">
              <div class="i-carbon-download"></div>
            </div>
            <h3 class="mt-12px text-15px font-bold text-text-primary">下载模板文件</h3>
            <p class="mt-4px text-13px lh-20px text-text-secondary">
              <a
                href="/songlist.xlsx"
                download
                class="text-brand-strong font-bold hover:underline underline-offset-2px"
              >下载 songlist.xlsx</a>,含「歌曲列表」与「站点配置」两个工作表
            </p>
          </div>
          <div class="surface-card p-20px relative">
            <span class="absolute top-8px right-16px text-28px font-900 text-[rgb(var(--brand)/0.15)] select-none">02</span>
            <div class="w-36px h-36px rounded-lg bg-brand-soft text-brand-strong text-18px flex-center">
              <div class="i-carbon-edit"></div>
            </div>
            <h3 class="mt-12px text-15px font-bold text-text-primary">填写「歌曲列表」</h3>
            <p class="mt-4px text-13px lh-20px text-text-secondary">
              按储量填写,模板已含示例,<b class="text-text-primary">请勿修改表头文字与列顺序</b>;「类型」列多个值用中英文分号分隔均可识别,「歌手」列多人支持顿号、中英文分号与 &amp; 符号
            </p>
          </div>
          <div class="surface-card p-20px relative">
            <span class="absolute top-8px right-16px text-28px font-900 text-[rgb(var(--brand)/0.15)] select-none">03</span>
            <div class="w-36px h-36px rounded-lg bg-brand-soft text-brand-strong text-18px flex-center">
              <div class="i-carbon-user-avatar"></div>
            </div>
            <h3 class="mt-12px text-15px font-bold text-text-primary">填写「站点配置」</h3>
            <p class="mt-4px text-13px lh-20px text-text-secondary">
              歌单标题、副标题、头像、背景图、主题色、点歌口令模板等;均可留空,留空时使用默认值
            </p>
          </div>
          <div class="surface-card p-20px relative">
            <span class="absolute top-8px right-16px text-28px font-900 text-[rgb(var(--brand)/0.15)] select-none">04</span>
            <div class="w-36px h-36px rounded-lg bg-brand-soft text-brand-strong text-18px flex-center">
              <div class="i-carbon-email"></div>
            </div>
            <h3 class="mt-12px text-15px font-bold text-text-primary">发送给我</h3>
            <p class="mt-4px text-13px lh-20px text-text-secondary">
              通过邮箱发送到
              <a
                href="mailto:1191230628@qq.com"
                class="text-brand-strong font-bold hover:underline underline-offset-2px"
              >1191230628@qq.com</a>,并通过 B 站私信通知我,制作完成后会回复
            </p>
          </div>
        </div>
      </section>

      <!-- 联系 -->
      <section class="pb-80px text-center">
        <h2 class="text-20px lh-28px font-600 text-text-primary">了解更多</h2>
        <p class="mt-8px text-14px text-text-secondary">请 B 站私信
          <a
            href="https://space.bilibili.com/23598218"
            target="_blank"
            rel="noopener noreferrer"
            class="text-brand-strong font-bold hover:underline underline-offset-2px"
          >归墟丶</a>
        </p>
      </section>
    </main>

    <footer class="text-center pb-32px text-12px text-text-secondary">
      Powered by
      <a
        href="https://space.bilibili.com/23598218"
        target="_blank"
        rel="noopener noreferrer"
        class="text-brand-strong hover:underline underline-offset-2px"
      >归墟</a>
      with GLM-5.3 flash
    </footer>
  </div>
</template>
