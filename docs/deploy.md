# 部署(Cloudflare)

## 站点部署

1. 把仓库推到 GitHub。
2. Cloudflare 控制台 → Workers & Pages → 创建 Pages 项目 → 连接该仓库。
3. 构建配置:框架预设选 Vite;构建命令 `npm run build`;输出目录 `dist`。
   建议加环境变量 `NODE_VERSION=22`。
5. **SPA 回退**:本项目按路径区分主播,依赖「未匹配路径回退 index.html」;
   构建产物中不要放 404.html(CF Pages 无 404.html 时自动启用 SPA 回退)。
4. 绑定自定义域名(根域或泛解析,国内访问稳定性明显更好)。

**SPA 路由注意**:本项目按路径区分主播(如 `/qixuan`),依赖「未匹配路径回退到
index.html」的 SPA 行为。CF Pages 在构建产物没有 404.html 时会自动启用该回退,
**不要**在 dist 里放 404.html,也不要在项目设置里关闭 SPA 模式。

## 自定义域名(域名在其他注册商时)

两种方式:

- **NS 迁移到 Cloudflare 托管(推荐)**:CF 控制台 Add a domain → 按提示到注册商处
  把 DNS 服务器改为 CF 分配的两个 NS → 生效后绑定域名全自动,根域也能用。
- **保留原 DNS,加 CNAME**:项目里添加子域名后,到注册商解析处加 CNAME 指向
  项目提示的目标值,回 CF 验证。根域名此方式较麻烦,建议绑定子域名。

注意:Workers 项目的自定义域必须在**项目内**添加(它会自动创建 DNS 记录);
若先手动在 DNS 里建了同名记录,添加时会报 "externally managed DNS records" 错,
把手动记录删掉再添加即可。

## 数据源部署(主播数据与代码仓库剥离)

主播的 `config.json` / `songs.json` 不随代码仓库提交,发布到独立的数据源
(当前为 **Worker 静态资产** `vupsong-config-data`,绑定自定义域名 `data.vupsong.com`)。

- **本地暂存**:真实主播数据放在 `data-local/streamers/<id>/{config,songs}.json`
  (gitignored);仓库内 `public/streamers/` 只保留 `example` 作为兜底示例。
- **发布**:`node scripts/publish.mjs`(加 `--dry-run` 预览、`--pages` 发布到
  Pages 项目 `songlistdatacache` 备用)。脚本会自动生成入驻清单 `streamers.json`
  并 wrangler 直传,代码仓库零提交、站点不重新构建。
- **站点侧**:构建时注入环境变量 `VITE_DATA_BASE_URL=https://data.vupsong.com`
  (本地写在 `.env.production.local`,Cloudflare Pages 构建设置里配同名变量);
  拉取顺序 = 数据源 → 同源仓库文件(兜底) → 默认主播内置数据 → 「没有找到主播」。
- **本地开发**:不依赖数据源。vite dev 中间件把 `data-local/streamers` 以同源
  `/streamers/*` 提供(含动态生成的 `streamers.json`)。
- **新增主播**:在 `data-local/streamers/` 建目录放入两个 json → 跑发布脚本即可,
  无需动代码仓库。

数据更新日常流程:主播交 Excel → `node scripts/excel-to-json.mjs <excel> <id>`
(输出到 `public/streamers/<id>/`,把生成的两个 json 移到 `data-local/streamers/<id>/`)
→ `node scripts/publish.mjs`。
