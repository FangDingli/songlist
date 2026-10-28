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
- 中文别名:config.json 的 `aliases` 数组(如 `["鸡蛋饼"]`),直查 config 404 时
  按入驻清单 `streamers.json` 反查真实 id,URL 保持别名不变;改别名后需重新发布
- 每主播两个文件(配置与数据分离,更新互不影响),存于**本地暂存区 `data-local/streamers/<id>/`**
  (gitignored,经 `scripts/publish.mjs` 发布到数据源,不进代码仓库):
  - `config.json`:meta(标题/副标题/头像/背景图/口令模板/
    主题色 `theme`/`uid`+`userProfileUrl`(主页,由 uid 派生)/
    `liveroomId`+`liveUrl`(直播间,由 liveroomId 派生)/favicon/`songsUpdatedAt`/
    `order`(首页入驻板块展示顺序,越小越靠前,缺省按 id 字典序))
  - `songs.json`:歌曲数组(远端原生结构:
    title/singer/lang/genre/sc/paid/remark/video)
- `public/streamers/` 只留 `example`(首页「查看示例歌单」的兜底示例,同源可达);
  `public/streamers/unavailable/` 是测试数据,两者都不进入入驻列表
- 首页「入驻主播」板块运行时拉取数据源的 `streamers.json`(发布脚本自动生成;
  dev 由 vite 中间件从 data-local 动态生成),拉取失败时隐藏板块
- 歌曲数据全部通过静态 json 文件获取,**不使用 API/Worker**(数据源为纯静态托管)
- `id`(歌曲)由 `src/utils/songs.ts` 的 `withIds` 运行时按行序生成,与外部编号解耦
- 展示 tag 由 `songTags()` 从 genre 按分隔符拆分,无需改组件;
  为空时返回空数组(纯歌名数据集不产生「未知」噪音)。
  历史 qiyuan 数据里的 `style` 键已废弃不读(代码已移除相关逻辑,json 不回改)
- 加新主播 = 在 `data-local/streamers/<id>/` 放入两个 json(+背景图)→ 跑
  `node scripts/publish.mjs`,无需提交代码仓库;详见 docs/deploy.md、docs/guide.md
- 默认主播 `config.ts` 的 `DEFAULT_STREAMER_ID`(`qiyuan`,现移入 unavailable)
  有打包内置数据(`src/data/qiyuan-config.json` + `qiyuan-songs.json`)首屏零等待

## 技术栈与命令

- Vite + Vue 3 + TS + UnoCSS(presetUno + presetIcons),组件手写不引库
- `npm run dev` / `npm run build`(vue-tsc + vite build)/ `npm run preview`

## 数据通道(三层,不使用 API/Worker,数据源为纯静态托管)

1. 数据源:`VITE_DATA_BASE_URL`(如 `https://data.vupsong.com`,写于
   `.env.production.local` 与 Pages 构建设置)下的
   `streamers/<id>/{config,songs}.json` 与入驻清单 `streamers.json`,
   由 `scripts/publish.mjs` 从 `data-local/` 直传发布
2. 同源兜底:`public/streamers/<id>/…`(仓库内仅 example)
3. 内置:默认主播数据打包(仅默认主播有首屏零等待)

拉取顺序 = 数据源 → 同源 → 内置,全部失败显示「没有找到主播」空态;
本地开发不依赖数据源(vite 中间件把 `data-local/streamers` 以同源提供)。

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
- 卡片内的 remark 面板/视频图标等悬浮元素**不占布局高度**(绝对定位覆盖下一行,
  hover/展开时提升 z-index);卡片根节点是 `role="button"` 的 div(button 内不能嵌链接)
- 刻意**没有用 TransitionGroup**(全量 diff 是之前的性能问题来源);新增动画别加回去
- 随机点歌不跳转定位;打乱顺序用瞬时回顶 + 错峰抖动入场动画(FLIP 在虚拟滚动下不可行)

## 主题色(重要)

- 色彩系统遵循 antdv-next design.md:默认主色 `#1677FF`,可读文字亮色 `#0958D9` /
  暗色 `#4096FF`,中性文字 #1F1F1F/#595959,边框 #D9D9D9(静态值在 tokens.css)
- 每主播可在 config.json 的 `meta.theme` 配置种子色(hex),
  `src/utils/theme.ts` 自动派生全套配色并保证 WCAG AA(≥4.5:1),亮暗模式联动;
  未配置时使用 `config.ts` 的 `DEFAULT_THEME`
- 品牌色填充上的文字一律白字(`--on-brand`);白字对比不足 4.5 时压深该处底色
  (`--on-brand-bg`,仅用于选中的筛选标签等品牌实底场景),不改动 `--brand` 本身
- 主题色适合性判断:转换脚本(`scripts/lib/theme-seed.mjs` 共用)对过浅/过淡的
  种子色做梯度计算(饱和度 ≥0.5、亮度 0.45~0.62,近中性色保持原样),
  excel 与 songlistcc 两个导入入口都会执行;运行时 WCAG 由 theme.ts 派生保证
- 主题派生同时驱动 `<meta name="theme-color">`(取页面底色)
- var() 颜色不支持 `/opacity` 修饰符,透明度变体在 uno theme 里显式定义(如 `brand.soft/light`)

## 约定与细节

- 外链一律 `target="_blank" rel="noopener noreferrer"`;bilibili 图床加 `referrerpolicy="no-referrer"`
- 站点 favicon 动态使用主播头像(`meta.avatar`,无 favicon 配置时),在 App.vue 设置
- 头像展示统一走 `utils/avatar.ts` 的 `resolveAvatar`/`avatarCandidates`:
  uid 存在时优先经第三方解析服务(`workers.vrp.moe`,307 到 B 站头像)动态获取,
  跟随主播更换头像;静态 `avatar` 字段为加载失败时的兜底,调用方逐级降级
- 观众在国内:部署走 Cloudflare + 自定义域名(见 docs/deploy.md),不要引入会被墙的运行时依赖
- 主播 excel 模板在 `public/songlist.xlsx`(首页提供下载,含「歌曲列表」「站点配置」
  两个工作表),表头与字段名不可改
- 转换脚本:`scripts/excel-to-json.mjs <excel> <id>`(类型列原样存 genre,「付费」列
  原样存 paid,「歌切」「备注」列原样存 video/remark,歌手分隔符统一为顿号);
  `scripts/json-to-excel.mjs <id> [输出路径]`(反向转换,与 excel-to-json 互逆:
  genre 原样写回「类型」列、sc 合成为「<n>SC」、video/remark 写回「歌切」「备注」);
  `scripts/songlistcc-to-json.mjs <json> <id>`(songlist.cc 导出格式,
  含 backColor 梯度派生主题色、pay/guard/gift 组合付费标记、#FFEBCD 视为默认色);
  `scripts/2some-to-json.mjs <slug> [id]`(在线抓取 2some.ren 歌单,
  走 Next.js Server Action,action id 硬编码在脚本头,失效时按注释重新提取)
- 页脚制作人员为固定文案(写在 App.vue footer),不走配置
- 提交信息与代码注释用中文
