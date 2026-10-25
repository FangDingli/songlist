/**
 * 从路径解析主播 id:example.com/xxx → xxx,支持中文(浏览器会百分号编码,
 * 此处解码还原);根路径返回 null(渲染系统介绍页),其余段落一律按 id 处理,
 * 数据不存在时由页面展示「没有找到主播」。
 */
export function getStreamerId(): string | null {
  let seg = window.location.pathname.split('/')[1]?.toLowerCase() ?? ''
  if (!seg) return null
  try {
    seg = decodeURIComponent(seg)
  } catch {
    /* 编码异常时按原样匹配 */
  }
  return seg
}
