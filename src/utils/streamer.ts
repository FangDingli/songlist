/**
 * 从路径解析主播 id:example.com/xxx → xxx。
 * 根路径返回 null(渲染系统介绍页);其余段落一律按 id 处理,
 * 数据不存在时由页面展示「没有找到主播」。合法字符:字母数字与连字符,≤32 位。
 */
export function getStreamerId(): string | null {
  const seg = window.location.pathname.split('/')[1]?.toLowerCase() ?? ''
  if (!seg) return null
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(seg) ? seg : seg
}
