# songlist-multi · 主播歌单(多主播通用版)

唱歌主播的歌曲展示页:直播间观众在这里搜索、筛选歌曲,点击卡片一键复制口令点歌。
一套代码服务多位主播,按路径区分(`example.com/<主播id>`),纯前端静态页面,
部署在 Cloudflare,无后端、无数据库。

根路径 `/` 是系统介绍页(含「入驻主播」列表),各主播歌单在 `/<主播id>`。

## 技术栈

Vite · Vue 3 · TypeScript · UnoCSS(组件全部手写,不引组件库)

## 本地开发

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器(/ 为介绍页,/<id> 为对应主播歌单)
npm run build      # vue-tsc 类型检查 + 构建产物到 dist/
npm run preview    # 预览构建产物
npm run studio     # 本地图形管理台(127.0.0.1:5199,可视化跑转换/发布/部署)
npm run deploy     # 构建并通过 wrangler 部署站点
```

本地开发不依赖线上数据源:vite 中间件把 `data-local/streamers` 以同源 `/streamers/*`
提供,并动态生成入驻清单 `streamers.json`。

## 数据从哪来

主播数据不进代码仓库,放在 `data-local/streamers/<id>/` 的 `config.json` + `songs.json`,
由 `node scripts/publish.mjs` 发布到独立静态数据源(`VITE_DATA_BASE_URL`)。
页面拉取顺序 = 数据源 → 同源仓库文件(兜底) → 默认主播内置数据 → 「没有找到主播」。

## 文档

- [部署与数据源发布](docs/deploy.md)
- [开发指南(新增主播 / 数据更新 / 主题 / 图片歌单)](docs/guide.md)
- [项目约定与改动须知](AGENTS.md)
