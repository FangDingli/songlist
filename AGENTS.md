# AGENTS.md

多主播歌曲展示页(点歌单通用版)。根路径 `/` 是系统介绍页(`LandingPage.vue`);
各主播页面在 `example.com/<主播id>`,观众搜索、筛选歌曲,点击卡片复制点歌口令
回直播间粘贴。一套代码服务多位主播,纯前端静态站,部署在 Cloudflare,
无后端、无数据库。

## 技术栈

- Vite + Vue 3(`<script setup>` + TS)+ UnoCSS(presetUno + presetIcons)
- 不用组件库,组件全部手写;图标用 `i-carbon-*`(carbon 图标集,用前查 icons.json 确认存在)
- `@vueuse/core`:仅用 `useElementSize` / `useWindowScroll` / `useWindowSize` 实现窗口级虚拟滚动
- `qrcode`:二维码生成(弹窗展示 + PNG 下载,头像居中)

## 主播与数据模型

- 主播 id = URL 路径段(`example.com/<id>`,支持中文,解码后匹配),由
  `src/utils/streamer.ts` 解析;根路径 `/` 返回 null 渲染介绍页,
  数据不存在的 id 显示「没有找到主播」空态
- 每主播两个文件(配置与数据分离,更新互不影响):
  - `public/streamers/<id>/config.json`:meta(标题/副标题/头像/背景图/口令模板/
    主题色 `theme`/主播主页 `streamerUrl`/直播间 `liveUrl`/favicon/`songsUpdatedAt`)
  - `public/streamers/<id>/songs.json`:歌曲数组(远端原生结构:
    title/singer/lang/genre/style/sc/paid/remark/video)
- 歌曲数据全部通过静态 json 文件获取,**不使用 API/Worker**
- `id`(歌曲)由 `src/utils/songs.ts` 的 `withIds` 运行时按行序生成,与外部编号解耦
- 展示 tag 由 `songTags()` 从 genre+style 实时合并拆分,无需改组件;
  两者皆空时返回空数组(纯歌名数据集不产生「未知」噪音)
- 加新主播 = 加 `public/streamers/<id>/` 下两个 json + 背景图 → 提交推送;
  详见 docs/guide.md
- 默认主播 `config.ts` 的 `DEFAULT_STREAMER_ID`(`qiyuan`)有打包内置数据
  (`src/data/qiyuan-config.json` + `qiyuan-songs.json`)首屏零等待

## 技术栈与命令

- Vite + Vue 3 + TS + UnoCSS(presetUno + presetIcons),组件手写不引库
- `npm run dev` / `npm run build`(vue-tsc + vite build)/ `npm run preview`

## 数据通道(两层,不使用 API/Worker)

1. 静态:`public/streamers/<id>/config.json`(meta)+ `songs.json`(歌曲数组),
   页面拉取 config → songs
2. 内置:默认主播数据打包(仅默认主播有首屏零等待)

拉取失败时:默认主播用内置数据,其他主播显示「没有找到主播」空态。

## UnoCSS preflight 的三个坑(已在 tokens.css 兜底,新项目同样要防)

1. 不重置 `<button>` 的 UA 默认 outset 边框、`<input>` 的 inset 边框
2. 不重置 `h1~h6`/`p` 的 UA 默认 1em 外边距(曾导致卡片超高、元素错位)
3. shortcut 里不能引用 `group`(不是 utility),父孙 hover 联动用 scoped CSS 写

## 虚拟滚动(改动须知)

`App.vue` 中窗口级虚拟滚动:列表按列数切块成行,只渲染视口附近约 60 张卡;
外层 div 撑起总高度 `rows.length * ROW_H`,内层按 `translateY(firstVisible * ROW_H)` 平移。

- **常量必须与样式同步**:`CARD_H = 90` 对应 song-card 的 `h-90px`,`GAP = 16` 对应行间距;
  改卡片高度时两处一起改,否则滚动定位错位
- 列数由容器宽度自动算(卡片最小 240px,1~5 列)
- 刻意**没有用 TransitionGroup**(全量 diff 是之前的性能问题来源);新增动画别加回去
- 随机点歌不跳转定位;打乱顺序用瞬时回顶 + 错峰抖动入场动画(FLIP 在虚拟滚动下不可行)

## 主题色(重要)

- 色彩系统遵循 antdv-next design.md:默认主色 `#1677FF`,可读文字亮色 `#0958D9` /
  暗色 `#4096FF`,中性文字 #1F1F1F/#595959,边框 #D9D9D9(静态值在 tokens.css)
- 每主播可在 config.json 的 `meta.theme` 配置种子色(hex),
  `src/utils/theme.ts` 自动派生全套配色并保证 WCAG AA(≥4.5:1),亮暗模式联动;
  未配置时使用 `config.ts` 的 `DEFAULT_THEME`
- 主题派生同时驱动 `<meta name="theme-color">`(取页面底色)
- var() 颜色不支持 `/opacity` 修饰符,透明度变体在 uno theme 里显式定义(如 `brand.soft/light`)

## 约定与细节

- 外链一律 `target="_blank" rel="noopener noreferrer"`;bilibili 图床加 `referrerpolicy="no-referrer"`
- 站点 favicon 动态使用主播头像(`meta.avatar`,无 favicon 配置时),在 App.vue 设置
- 观众在国内:部署走 Cloudflare + 自定义域名(见 docs/deploy.md),不要引入会被墙的运行时依赖
- 主播 excel 模板在 `public/songlist.xlsx`(首页提供下载,含「歌曲列表」「站点配置」
  两个工作表),表头与字段名不可改
- 转换脚本:`scripts/excel-to-json.mjs <excel> <id>`(类型列原样存 genre,
  歌手分隔符统一为顿号,「付费」列原样存 paid);
  `scripts/songlistcc-to-json.mjs <json> <id>`(songlist.cc 导出格式,
  含 backColor 梯度派生主题色、pay/guard/gift 组合付费标记、#FFEBCD 视为默认色)
- 页脚制作人员为固定文案(写在 App.vue footer),不走配置
- 提交信息与代码注释用中文
