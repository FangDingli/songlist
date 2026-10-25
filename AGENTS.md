# AGENTS.md

多主播歌曲展示页(点歌单通用版)。根路径 `/` 是系统介绍页(`LandingPage.vue`);
各主播页面在 `example.com/<主播id>`,观众搜索、筛选歌曲,点击卡片复制点歌口令
回直播间粘贴。一套代码服务多位主播,纯前端静态站,部署在 Cloudflare,
无后端、无数据库。

## 技术栈

- Vite + Vue 3(`<script setup>` + TS)+ UnoCSS(presetUno + presetIcons)
- 不用组件库,组件全部手写;图标用 `i-carbon-*`(carbon 图标集)
- `@vueuse/core`:仅用 `useElementSize` / `useWindowScroll` / `useWindowSize` 实现窗口级虚拟滚动
- 数据按主播存放:`public/data/<id>.json`(远端原样结构,零转换),页面运行时拉取;
  默认主播另有一份打包内置数据(`src/data/qiyuan.json`)用于首屏零等待

## 主播与数据模型

- 主播 id = URL 路径段(`example.com/<id>`,支持中文,解码后匹配),由
  `src/utils/streamer.ts` 解析;
  根路径 `/` 返回 null 渲染介绍页,数据不存在的 id 显示「没有找到主播」空态;
  默认主播 `config.ts` 的 `DEFAULT_STREAMER_ID`(`qiyuan`)有打包内置数据首屏零等待
- 每主播两个文件:`public/streamers/<id>/config.json`(meta:标题/副标题/头像/
  背景图/口令模板/主题色/主播主页/页脚 credits)+ `public/streamers/<id>/songs.json`
  (远端原生结构数组:title/singer/lang/genre/style/sc/paid/remark/video)
- `id`(歌曲)由 `src/utils/songs.ts` 的 `withIds` 运行时按行序生成,与外部编号解耦
- 展示 tag 由 `songTags()` 从 genre+style 实时合并拆分,无需改组件
- 加新主播 = 加 `public/data/<id>.json` + 背景图 → Worker `UPSTREAMS` 加一行
  (有远端源时)→ DNS 加记录;详见 docs/guide.md

## 技术栈与命令

- Vite 7 + Vue 3 + TS + UnoCSS(presetUno + presetIcons),组件手写不引库
- `npm run dev` / `npm run build`(vue-tsc + vite build)/ `npm run preview`

## 数据通道(三层)

1. 自动:CF Worker(`songs-cache`)按 `UPSTREAMS` 映射从 CF 内部抓取各主播远端数据,
   Cache API 缓存 5 天,经同源 `/api/<id>.json` 提供;代码与路由见 docs/deploy.md
2. 静态:`public/streamers/<id>/songs.json`(手动更新的兜底;配置在同目录
   `config.json`,更新数据与改配置互不影响)
3. 内置:默认主播数据打包(仅默认主播有首屏零等待)

页面拉取顺序 `/api/<id>.json` → `/data/<id>.json`,全失败时:
默认主播用内置数据,其他主播显示「没有找到主播」空态。

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

## 设计 token(重要)

全部在 `src/styles/tokens.css`,rgb 三元组定义,`:root` 亮色、`.dark` 暗色,
UnoCSS 用 `rgb(var(--x))` 引用,组件里不需要写 `dark:` 变体。

- 主色 `--brand` = #AA99FF 只用于填充/装饰;对白底对比仅 2.4:1,**禁止**做小字文字色或垫白字
- 小字文字用 `--brand-strong`(亮色 #7050E8 / 暗色 #BABFFF);品牌紫填充上的文字用 `--on-brand`
- var() 颜色不支持 `/opacity` 修饰符,透明度变体在 uno theme 里显式定义(如 `brand.soft/light`)

## 约定与细节

- 改主题色只动 tokens.css,并同步 `index.html` 的 `<meta name="theme-color">`
  与 `useTheme.ts` 里暗色的 theme-color 值
- 外链一律 `target="_blank" rel="noopener noreferrer"`;bilibili 图床加 `referrerpolicy="no-referrer"`
- 观众在国内:部署走 Cloudflare + 自定义域名(见 docs/deploy.md),不要引入会被墙的运行时依赖
- 主播 excel 模板在 `public/songlist.xlsx`(首页提供下载),表头不可改;
  转换脚本 `scripts/excel-to-json.mjs`:类型列原样存 genre(songTags 拆分展示),
  歌手分隔符统一为顿号,备注匹配「30SC」提取为 sc 数值、原文存 remark
- 转换脚本:excel 模板用 `scripts/excel-to-json.mjs`;songlist.cc 导出的 json
  用 `scripts/songlistcc-to-json.mjs`(含 backColor 梯度派生、pay/guard/gift 组合付费标记)
- 提交信息与代码注释用中文
