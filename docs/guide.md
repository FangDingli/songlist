# 开发指南

## 新增一个主播(三步)

1. **歌曲数据**:主播填好模板 excel 后,
   运行 `node scripts/excel-to-json.mjs <excel路径> <主播id>`,
   生成 `data-local/streamers/<id>/songs.json`(原样结构数组,零手工转换)。
2. **配置**:手写 `data-local/streamers/<id>/config.json`(转换脚本会自动生成
   含已填站点信息的初始文件),可编辑字段:

```json
{
  "title": "某某的歌单",
  "subtitle": "点击卡片复制点歌口令,回到直播间粘贴即可点歌",
  "avatar": "https://头像地址.jpg",
  "bg": { "mobile": "/bg/<id>/mobile.png", "desktop": "/bg/<id>/desktop.jpg" },
  "orderTemplate": "点歌 {title} {singer}",
  "uid": "主播uid",
  "userProfileUrl": "https://space.bilibili.com/主播uid",
  "liveroomId": "直播间id",
  "liveUrl": "https://live.bilibili.com/直播间id",
  "favicon": "https://favicon地址.ico",
  "theme": "#1677FF",
  "songsUpdatedAt": "2026-10-24",
  "credits": [{ "label": "名字", "href": "链接", "note": "备注" }]
}
```

   所有字段均可省略,省略时用默认值;背景图放 `public/bg/<id>/`;
  favicon 缺省时使用头像;`songsUpdatedAt` 由转换脚本自动写入,驱动页脚日期。
  `userProfileUrl` / `liveUrl` 由 `uid` / `liveroomId` 派生(转换脚本自动生成),
  一般只需填 `uid` 和 `liveroomId`。
  侧栏「生成二维码」按钮可为当前主播页生成二维码(中间嵌头像),支持下载 PNG,
  供直播时展示给观众扫码进入。
3. **发布**:`node scripts/publish.mjs` 把数据直传到数据源(秒级生效),
   `example.com/<id>` 即可访问,无需提交代码仓库。

> 根路径 `example.com/` 是系统介绍页(源码 `src/components/LandingPage.vue`,
> 文案可直接改组件内常量);各主播页面在 `/<id>`。

## 数据更新(手动)

数据与配置分离存放,更新互不影响(均指 `data-local/streamers/<id>/` 下的文件,
改完跑 `node scripts/publish.mjs` 发布):

- `songs.json`:歌曲数组,用最新数据原样覆盖即可
  (或拿到主播的新 excel 后重跑 `node scripts/excel-to-json.mjs <excel> <id>`,
  脚本会同步刷新 config.json 里的 `songsUpdatedAt`)。
- `config.json`:标题/头像/背景/主题色等,按需编辑。

## 主题与暗黑模式

所有颜色 token 在 `src/styles/tokens.css`,以 rgb 三元组变量定义,
`:root` 为亮色值、`.dark` 为暗色值,UnoCSS 通过 `rgb(var(--x))` 引用,
因此两套模式自动切换,组件代码里不需要写 `dark:` 变体。

暗黑模式逻辑在 `src/composables/useTheme.ts`:默认跟随系统
(`prefers-color-scheme`),点击主题按钮在「跟随系统 → 亮色 → 暗色」间循环,
选择持久化在 localStorage(键 `songlist-theme`)。

改主题色时关注这几个变量:

```css
--brand: 170 153 255;        /* 主色 #AA99FF,用于填充/装饰 */
--brand-strong: 112 80 232;  /* 浅底上的可读紫(小字文字);.dark 里换浅紫 */
--on-brand: 30 27 58;        /* 印在品牌紫填充上的文字色 */
--bg-base / --bg-card        /* 页面底 / 卡片底,亮暗各一套 */
```

注意:主色 `#AA99FF` 对白底对比仅 2.4:1,不要直接用它做小字文字色或
垫白字,小字用 `text-brand-strong`,紫底文字用 `text-on-brand`。
改主题时记得同步 `index.html` 的 `<meta name="theme-color">`
以及 `useTheme.ts` 里暗色模式的对应值。

歌曲卡片的语种/类型彩色 tag 配色在 `src/components/SongCard.vue` 的
`TAG_PALETTE`,按 key 哈希稳定取色,新增语种/类型无需改动。

## 点歌口令格式

每主播在数据文件的 `meta.orderTemplate` 里配置,支持占位符
`{title}` `{singer}` `{lang}` `{tags}`;缺省为 `点歌 {title} {singer}`。

## 代码结构

```
src/
  App.vue                  # 页面:主播识别/数据加载/固定背景层/侧栏/虚拟滚动网格/Toast
  config.ts                # 默认主播 id、兜底 meta、口令渲染
  types.ts                 # Song / StreamerMeta 数据结构
  data/qiyuan.json         # 默认主播的打包数据(首屏零等待,仅默认主播)
  utils/songs.ts           # 运行时生成 id、genre+style 合并拆分为展示 tag
  utils/streamer.ts        # 从路径解析主播 id
  components/
    SongCard.vue           # 歌曲卡片(编号水印/复制遮罩/SC 标记/彩色 tag)
    FilterPanel.vue        # 搜索 + 随机按钮 + 单选筛选(移动与桌面共用)
    MobileFilterBar.vue    # 移动端滚动时出现的紧凑筛选条
    LandingPage.vue        # 根路径系统介绍页
    TagPill.vue            # 筛选标签
    RotatingDisc.vue       # 侧栏旋转唱片机(链接到主播主页)
  composables/
    useClipboard.ts        # 剪切板(含非 HTTPS 兜底)
    useToast.ts            # 全局提示
    useTheme.ts            # 亮暗主题(自动跟随系统 + 手动循环切换)
  styles/tokens.css        # 设计 token + 全局 reset 兜底 + 动画
scripts/
  excel-to-json.mjs        # 主播 excel 模板 → songs.json 转换脚本
public/
  songlist.xlsx            # 主播填写的歌单模板(首页提供下载)
  streamers/<id>/          # 各主播数据:config.json(配置)+ songs.json(歌曲)
  bg/<id>/                 # 各主播背景图
```
