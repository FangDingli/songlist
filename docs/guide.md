# 开发指南

## 新增一个主播(三步)

1. **歌曲数据**:主播填好模板 excel 后,运行
   `node scripts/excel-to-json.mjs <excel路径> <主播id>`,
   脚本直接写入 `data-local/streamers/<id>/songs.json`(原样结构数组,零手工转换),
   同时合并生成 `config.json` 并写入 `songsUpdatedAt`。
2. **配置**:按需编辑 `data-local/streamers/<id>/config.json`,可编辑字段:

```json
{
  "title": "某某的歌单",
  "subtitle": "点击卡片复制点歌口令,回到直播间粘贴即可点歌",
  "avatar": "https://头像地址.jpg",
  "avatarManual": false,
  "mobileCols": 1,
  "bg": { "mobile": "/bg/<id>/mobile.png", "desktop": "/bg/<id>/desktop.jpg" },
  "orderTemplate": "点歌 {title} {singer}",
  "uid": "主播uid",
  "liveroomId": "直播间id",
  "favicon": "https://favicon地址.ico",
  "theme": "#1677FF",
  "themeForced": false,
  "aliases": ["中文别名"],
  "songsUpdatedAt": "2026-10-24"
}
```

   所有字段均可省略,省略时用默认值;背景图放 `public/bg/<id>/`;
   `favicon` 缺省时使用头像;`songsUpdatedAt` 由转换脚本自动写入,驱动页脚日期。
   `userProfileUrl` / `liveUrl` 由 `uid` / `liveroomId` 派生(转换脚本自动写入),
   一般只需填 `uid` 和 `liveroomId`,不要手改这两个 URL。
   页脚制作人员是固定文案(写在 App.vue),不走配置。

   - `aliases`:中文/别名路径(如 `/鸡蛋饼`),直接查不到 config 时按入驻清单反查真实 id,
     URL 保持别名不变;改别名后需重新发布。
   - `theme`:主题种子色(hex),全套配色由 `src/utils/theme.ts` 运行时派生并保证 WCAG AA;
     在 excel 主题色前加「!」(或 `themeForced: true`)可强制用原色做主色。
   - `avatarManual`:设为 `true` 时只使用 `avatar` 静态地址,不通过 `uid` 动态解析头像。
     解析服务偶尔会返回 B 站默认头像(`noface.jpg`)而主播其实有头像,遇到这种情况
     给该主播开这个开关即可(参考 `theme` / `themeForced` 的按主播配置方式)。
     excel 里给「头像图片地址」的值加「!」前缀也能让转换脚本写入该字段;
     想恢复自动解析,把 config.json 里的 `avatarManual` 删掉或改成 `false`。
   - `mobileCols`:手机端默认列数,填 `1` 或 `2`,**缺省 1 列**。tag 多的歌单
     (窄卡放不下几个类型标签)保持 1 列,tag 少的可设为 2 列提高一屏信息量。
     观众可在手机顶栏用布局按钮临时切换 1⇄2,选择按主播 id 存在自己浏览器里,
     不影响其他主播、也不需要重新发布;切回主播配置的值时自动恢复「跟随设置」。
     excel「站点配置」加一行「手机端列数」填 1/2 也能让转换脚本写入;
     留空则保留 config.json 里手改的值(转换脚本会合并已有 config,不会覆盖)。
     注意 `json-to-excel.mjs` 反向导出严格按 `public/songlist.xlsx` 模板行序,
     若模板里没有补这一行,导出的 excel 不含该字段,但 config.json 里的值仍在。
   - 首页「入驻主播」的展示顺序由 `data-local/streamers/order.json` 的 id 数组决定
     (数组序即展示序,未列出的按 id 字典序垫底),改顺序只动这一个文件。

   侧栏「生成二维码」按钮生成当前主播页二维码(中间嵌头像),可下载 PNG 供直播展示;
   「生成图片歌单」按钮把全量歌名排成竖版长图,供主播发动态。

3. **发布**:`node scripts/publish.mjs` 把数据直传到数据源(秒级生效),
   `example.com/<id>` 即可访问,无需提交代码仓库、无需重新构建站点。
   加 `--dry-run` 只生成 `.publish-tmp/` 供检查。

> 根路径 `example.com/` 是系统介绍页(源码 `src/components/LandingPage.vue`,
> 文案可直接改组件内常量);各主播页面在 `/<id>`。
> 不想敲命令时跑 `npm run studio`,用图形管理台完成转换、发布与部署。

## 数据更新(手动)

数据与配置分离存放,更新互不影响(均指 `data-local/streamers/<id>/` 下的文件,
改完跑 `node scripts/publish.mjs` 发布):

- `songs.json`:歌曲数组,用最新数据原样覆盖即可
  (或拿到主播的新 excel 后重跑 `node scripts/excel-to-json.mjs <excel> <id>`,
  脚本会同步刷新 config.json 里的 `songsUpdatedAt`)。
- `config.json`:标题/头像/背景/主题色等,按需编辑。
- 反向导出:`node scripts/json-to-excel.mjs <id> [输出路径]` 把现有数据写回
  模板格式的 excel,便于发给主播核对。
- 其它数据源:`scripts/songlistcc-to-json.mjs <json> <id>`(songlist.cc 导出)、
  `scripts/2some-to-json.mjs <slug> [id]`(在线抓取 2some.ren)。

## 主题与暗黑模式

颜色 token 在 `src/styles/tokens.css`,以 rgb 三元组变量定义,
`:root` 为亮色值、`.dark` 为暗色值,UnoCSS 通过 `rgb(var(--x))` 引用,
因此两套模式自动切换,组件里不需要写 `dark:` 变体。
默认值遵循 antdv-next:主色 `#1677FF`,可读文字亮色 `#0958D9` / 暗色 `#4096FF`。

**改主题色不需要改 CSS**:每主播在 config.json 配一个 `theme` 种子色,
`src/utils/theme.ts` 在运行时把它写到 `documentElement` 行内样式,自动派生
`--brand`(填充/装饰)、`--brand-strong`(小字可读色)、`--on-brand` / `--on-brand-bg`
(品牌实底上的白字及其底)、`--bg-base` / `--bg-scrim`(页面底与过渡层),
并同步 `<meta name="theme-color">`;亮暗模式与每主播主题都走同一套逻辑。
小字用 `text-brand-strong`,品牌实底上的文字用 `text-on-brand`,不要直接用主色。

转换脚本(`scripts/lib/theme-seed.mjs`)会对过浅/过淡的种子色先做适合性调整
(饱和度 ≥0.5、亮度 0.45~0.62),excel 与 songlist.cc 两个导入入口都会执行。

暗黑模式逻辑在 `src/composables/useTheme.ts`:默认跟随系统
(`prefers-color-scheme`),点击主题按钮在「跟随系统 → 亮色 → 暗色」间循环,
选择持久化在 localStorage(键 `songlist-theme`)。

歌曲卡片的分类 tag 配色在 `src/components/SongCard.vue` 的 `TAG_PALETTE`,
按 key 哈希稳定取色;tag 全部渲染,第二行 `overflow-hidden` 保证不撑破卡片,
tag 多时歌手可被挤压,完整列表放在该行 `title` 里。

## 点歌口令格式

每主播在 config.json 的 `orderTemplate` 里配置,支持占位符
`{title}` `{singer}` `{lang}` `{tags}`;缺省为 `点歌 {title} {singer}`。

## 歌曲类型的分隔符

`genre` 是原样字符串,页面用 `src/utils/songs.ts` 的 `songTags()` 拆分:
支持中英文分号、逗号、顿号和斜杠(`/`)四种分隔符,拆分后去重、去掉空值。
转换脚本不改写这个字段(excel「类型」列、songlist.cc 的 style 都原样存入),
筛选标签与 `{tags}` 口令占位符共用同一份拆分结果。

## 图片歌单与二维码

- 图片歌单:`src/components/SonglistImageModal.vue` + `src/utils/songlist-image.ts`,
  纯 Canvas 把全量歌名排成竖版长图,可自定义文字色/背景色/背景图/尺寸/标题开关/编号开关,
  超出单页自动分页,一次导出多张 PNG。入口在侧栏头像卡与移动端顶栏。
- 二维码:`src/components/QrModal.vue`,用 `qrcode` 生成(H 级纠错),中间嵌主播头像,
  弹窗展示与 PNG 下载;下载的 PNG 不含头像,带头像的可直接截图。

## 本地图形管理台

`npm run studio` 启动 `scripts/studio.mjs`,浏览器打开 `http://127.0.0.1:5199`。
仅监听本机、不做鉴权,不要暴露到公网。功能:主播列表(生成 excel / 导入 excel /
打开数据目录)、songlist.cc 与 2some 抓取、发布数据源、构建并部署站点;
脚本以仓库根为 cwd 执行,日志经 SSE 实时回显。

## 代码结构

```
src/
  App.vue                       # 编排:主播识别/数据加载/背景层/侧栏/虚拟滚动/弹窗/Toast
  config.ts                     # 默认主播 id、数据源地址、兜底 meta、口令渲染
  types.ts                      # Song / StreamerMeta / FilterTag
  main.ts                       # 入口(uno.css + tokens.css,禁用滚动位置恢复)
  data/qiyuan-config.json       # 默认主播打包配置(仅默认主播首屏零等待)
  data/qiyuan-songs.json        # 默认主播打包歌曲
  utils/
    streamer.ts                 # 从路径解析主播 id(支持中文)
    songs.ts                    # withIds() 运行时编号、songTags() 拆分 genre
    theme.ts                    # 由种子色派生全套配色(WCAG AA)
    avatar.ts                   # 头像候选链(含 avatarManual 开关)、缩略图、兜底背景
    songlist-image.ts           # Canvas 竖版长图排版与导出
  components/
    SongCard.vue                # 歌曲卡片(编号水印/复制遮罩/付费标记/彩色 tag)
    FilterPanel.vue             # 搜索 + 随机/打乱 + 单选筛选(移动与桌面共用)
    MobileFilterBar.vue         # 移动端上滑时出现的紧凑筛选条
    LandingPage.vue             # 根路径系统介绍页(含入驻主播板块)
    TagPill.vue                 # 筛选标签
    RotatingDisc.vue            # 侧栏旋转唱片机(点击进入直播间)
    AvatarImage.vue             # 统一头像:容器背景兜底 + 候选降级 + avatarManual
    QrModal.vue                 # 二维码弹窗与下载
    SonglistImageModal.vue      # 图片歌单生成弹窗
  composables/
    useClipboard.ts             # 剪切板(含非 HTTPS 兜底)
    useToast.ts                 # 全局提示
    useTheme.ts                 # 亮暗主题(跟随系统 + 手动循环)
  styles/tokens.css             # 设计 token + 全局 reset 兜底 + 动画
scripts/
  excel-to-json.mjs             # excel 模板 → data-local/streamers/<id>/{songs,config}.json
  json-to-excel.mjs             # 反向导出 excel(与上面互逆)
  songlistcc-to-json.mjs        # songlist.cc 导出格式
  songlistcc-fetch-to-json.mjs  # songlist.cc 在线抓取
  2some-to-json.mjs             # 2some.ren 在线抓取
  xiaoshen-ocr-to-json.mjs      # OCR 结果转换
  publish.mjs                   # data-local 直传数据源 + 生成 streamers.json
  studio.mjs                    # 本地图形管理台
  lib/                          # theme-seed / streamer-order / songlistcc-convert 共用逻辑
data-local/streamers/<id>/      # 真实主播数据(gitignored):config.json + songs.json
data-local/streamers/order.json # 首页入驻主播展示顺序
public/
  songlist.xlsx                 # 主播填写的歌单模板(首页提供下载)
  streamers/example/            # 示例歌单(仓库内唯一同源兜底数据)
  bg/<id>/                      # 各主播背景图
```
