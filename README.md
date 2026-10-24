# songlist-multi · 主播歌单(多主播通用版)

唱歌主播的歌曲展示页:直播间观众在这里搜索、筛选歌曲,点击卡片一键复制口令点歌。
一套代码服务多位主播,按路径区分(`example.com/<主播id>`),纯前端静态页面,
部署在 Cloudflare,无后端、无数据库。

## 技术栈

Vite · Vue 3 · TypeScript · UnoCSS

## 本地开发

```bash
npm install    # 安装依赖
npm run dev    # 启动开发服务器(访问 / 为默认主播,/其他id 为对应主播)
npm run build  # 类型检查 + 构建产物到 dist/
```

## 文档

- [部署与数据缓存 Worker](docs/deploy.md)
- [开发指南(新增主播 / 数据更新 / 主题)](docs/guide.md)
