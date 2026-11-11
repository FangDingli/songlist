/**
 * 本地管理台(图形化界面):npm run studio 后浏览器打开,免命令行跑脚本。
 * 仅监听 127.0.0.1,供本机使用(不做鉴权,不要暴露到公网)。
 *
 * 功能:
 * - 主播列表(data-local/streamers/*):生成 excel / 导入 excel / 打开数据目录
 * - 2some 抓取:输入站点 slug 在线拉歌单
 * - 全局操作:发布数据源(publish.mjs) / 构建并部署站点(npm run deploy)
 * - 脚本以仓库根为 cwd 子进程执行,日志经 SSE 实时流到页面(同时并发的任务按 id 区分)
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = '127.0.0.1'
const PORT = 5199

/* ---------- 任务与日志(SSE) ---------- */
let jobSeq = 0
const jobs = new Map() // id -> { name, args, lines, done, code }
const sseClients = new Set()

function broadcast(jobId, line) {
  const payload = `data: ${JSON.stringify({ jobId, line })}\n\n`
  for (const res of sseClients) res.write(payload)
}

/** 以仓库根为 cwd 执行脚本;返回 promise,日志实时推送 */
function runJob(name, args = []) {
  const id = String(++jobSeq)
  const job = { name, args, lines: [], done: false, code: null }
  jobs.set(id, job)
  const printable = ['node', name, ...args].join(' ')
  job.lines.push(`$ ${printable}`)
  broadcast(id, `$ ${printable}`)

  return new Promise((resolvePromise) => {
    const child = spawn('node', [resolve('scripts', name), ...args], {
      cwd: ROOT,
      shell: process.platform === 'win32',
    })
    const feed = (chunk) => {
      for (const line of String(chunk).replace(/\r/g, '').split('\n').filter(Boolean)) {
        job.lines.push(line)
        broadcast(id, line)
      }
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('close', (code) => {
      job.done = true
      job.code = code
      const tail = code === 0 ? `✓ 完成(退出码 ${code})` : `✗ 失败(退出码 ${code})`
      job.lines.push(tail)
      broadcast(id, tail)
      resolvePromise(code)
    })
  })
}

function listStreamers() {
  const dir = resolve(ROOT, 'data-local/streamers')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const has = (f) => existsSync(resolve(dir, e.name, f))
      return { id: e.name, config: has('config.json'), songs: has('songs.json') }
    })
}

/* ---------- HTTP ---------- */
const PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>歌单管理台</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box }
  body { margin: 0; font: 14px/1.6 system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: #e8f1ff; color: #1f1f1f; padding: 24px; }
  .card { background: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
    box-shadow: 0 2px 10px rgba(22,119,255,.08); }
  h1 { font-size: 20px; margin: 0 0 4px } h2 { font-size: 15px; margin: 0 0 12px }
  .sub { color: #595959; font-size: 12px; margin-bottom: 16px }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid #d9d9d9;
    background: #fff; color: #1f1f1f; cursor: pointer; }
  button:hover { border-color: #1677ff; color: #1677ff }
  button.primary { background: #1677ff; color: #fff; border-color: #1677ff; }
  button.primary:hover { background: #0958d9 }
  button:disabled { opacity: .5; cursor: not-allowed }
  input { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid #d9d9d9; width: 240px }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap }
  table { border-collapse: collapse; width: 100% }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0 }
  .tag { font-size: 11px; padding: 1px 8px; border-radius: 99px; margin-right: 4px }
  .ok { background: #e6f4ff; color: #0958d9 } .miss { background: #fff2e8; color: #fa8c16 }
  #log { background: #161b28; color: #d6deeb; font: 12px/1.7 Consolas, monospace; height: 300px;
    overflow-y: auto; border-radius: 10px; padding: 12px 14px; white-space: pre-wrap; word-break: break-all }
  .muted { color: #8c8c8c }
</style></head><body>
<h1>歌单管理台</h1>
<div class="sub">本机使用(127.0.0.1) · 脚本以仓库根为工作目录,无需手动跳转与复制路径</div>

<div class="card">
  <h2>全局操作</h2>
  <div class="row">
    <button class="primary" onclick="run('publish.mjs')">发布数据源</button>
    <button class="primary" onclick="runDeploy()">构建并部署站点</button>
    <span style="flex:1"></span>
    <input id="slug" placeholder="2some slug,如 moling"/>
    <input id="slugId" placeholder="主播 id(可留空)" style="width:160px"/>
    <button onclick="run('2some-to-json.mjs', [document.getElementById('slug').value.trim(), document.getElementById('slugId').value.trim()].filter(Boolean))">2some 抓取</button>
  </div>
</div>

<div class="card">
  <h2>主播(data-local/streamers)</h2>
  <table id="streamers"><tbody></tbody></table>
</div>

<div class="card">
  <h2>日志</h2>
  <div id="log"><span class="muted">等待任务…</span></div>
</div>

<script>
const logEl = document.getElementById('log')
let running = false
function append(line, jobId) {
  if (logEl.firstChild?.classList?.contains('muted')) logEl.textContent = ''
  logEl.textContent += line + '\\n'
  logEl.scrollTop = logEl.scrollHeight
}
async function refresh() {
  const list = await (await fetch('/api/streamers')).json()
  const tb = document.querySelector('#streamers tbody')
  tb.innerHTML = ''
  for (const s of list) {
    const tr = document.createElement('tr')
    tr.innerHTML = '<td><b>' + s.id + '</b> <span class="tag ' + (s.config ? 'ok' : 'miss') + '">config</span>' +
      '<span class="tag ' + (s.songs ? 'ok' : 'miss') + '">songs</span></td>' +
      '<td><div class="row">' +
      '<button onclick="run(\\'json-to-excel.mjs\\', [\\'' + s.id + '\\'])">生成 excel</button>' +
      '<button onclick="importExcel(\\'' + s.id + '\\')">导入 excel</button>' +
      '<button onclick="openDir(\\'' + s.id + '\\')">打开目录</button>' +
      '</div></td>'
    tb.appendChild(tr)
  }
}
function setRunning(v) {
  running = v
  document.querySelectorAll('button').forEach((b) => (b.disabled = v))
}
async function run(script, args = []) {
  if (running) return alert('有任务正在运行,请等待完成')
  setRunning(true)
  const res = await fetch('/api/run', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, args }) })
  const data = await res.json()
  if (!data.ok) { setRunning(false); return alert(data.error) }
}
function runDeploy() {
  if (running) return alert('有任务正在运行,请等待完成')
  setRunning(true)
  fetch('/api/deploy', { method: 'POST' })
}
function importExcel(id) {
  const p = prompt('输入 excel 文件路径(含文件名):')
  if (!p) return
  run('excel-to-json.mjs', [p, id])
}
async function openDir(id) { await fetch('/api/open-dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) }
const es = new EventSource('/api/events')
es.onmessage = (e) => {
  const { jobId, line } = JSON.parse(e.data)
  append(line, jobId)
  if (line.startsWith('✓') || line.startsWith('✗')) setRunning(false)
}
refresh()
</script>
</body></html>`

/* ---------- 路由 ---------- */
const json = (res, obj, code = 200) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(PAGE)
    return
  }
  if (url.pathname === '/api/streamers') return json(res, listStreamers())
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { script, args = [] } = JSON.parse(body || '{}')
      const scriptPath = resolve('scripts', script)
      if (!script.startsWith('scripts/') && !existsSync(scriptPath)) {
        return json(res, { ok: false, error: `脚本不存在:${script}` }, 400)
      }
      if (script !== 'publish.mjs' && script !== '2some-to-json.mjs' && script !== 'excel-to-json.mjs' && script !== 'json-to-excel.mjs') {
        return json(res, { ok: false, error: `不允许执行的脚本:${script}` }, 400)
      }
      runJob(script, args.map(String))
      json(res, { ok: true })
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/deploy') {
    // 构建并部署:串行跑 build(类型检查+vite)与 wrangler deploy,复用日志流
    const id = String(++jobSeq)
    const job = { name: 'npm run deploy', lines: [], done: false, code: null }
    jobs.set(id, job)
    json(res, { ok: true })
    job.lines.push('$ npm run deploy(类型检查 → 构建 → wrangler 部署)')
    broadcast(id, job.lines[0])
    const child = spawn('npm', ['run', 'deploy'], { cwd: ROOT, shell: process.platform === 'win32' })
    const feed = (chunk) => {
      for (const line of String(chunk).replace(/\r/g, '').split('\n').filter(Boolean)) {
        job.lines.push(line)
        broadcast(id, line)
      }
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('close', (code) => {
      job.done = true
      job.code = code
      const tail = code === 0 ? '✓ 部署完成' : `✗ 部署失败(退出码 ${code})`
      job.lines.push(tail)
      broadcast(id, tail)
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/open-dir') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { id } = JSON.parse(body || '{}')
      const dir = resolve(ROOT, 'data-local/streamers', String(id ?? '').replace(/[^\w\u4e00-\u9fa5-]/g, ''))
      if (!id || !existsSync(dir)) return json(res, { ok: false, error: '目录不存在' }, 400)
      spawn('explorer.exe', [dir], { cwd: ROOT, shell: process.platform === 'win32' })
      json(res, { ok: true })
    })
    return
  }

  res.writeHead(404)
  res.end('not found')
}).listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`
  console.log(`管理台已启动:${url}(仅本机可访问,Ctrl+C 停止)`)
  // 自动打开浏览器
  import('node:child_process').then(({ spawn }) => {
    spawn('cmd', ['/c', 'start', '', url], { shell: false, detached: true }).unref()
  })
})
