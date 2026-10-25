/** 头像动态解析服务(307 重定向到 B 站头像,自带缩放后缀),跟随主播更换头像 */
const BILIBILI_AVATAR_API = 'https://workers.vrp.moe/api/bilibili/avatar'

/**
 * 头像解析:uid 存在时优先走动态解析服务(避免 B 站换头像后站点长期过期),
 * 静态 avatar 字段作为加载失败时的兜底,调用方按候选列表逐个降级。
 */
export function resolveAvatar(meta: { uid?: string; avatar?: string }): string {
  const uid = meta.uid?.trim()
  if (uid) return `${BILIBILI_AVATAR_API}/${uid}`
  return meta.avatar?.trim() ?? ''
}

/** 候选列表:动态解析 + 静态地址去重,供调用方在加载失败时逐级降级 */
export function avatarCandidates(meta: { uid?: string; avatar?: string }): string[] {
  return [...new Set([resolveAvatar(meta), meta.avatar?.trim() ?? ''].filter(Boolean))]
}

/**
 * bilibili 图床缩略图:头像原图很大,缩到小尺寸会锯齿,
 * 追加 @<size>.webp 后缀让 CDN 直接出小图;非 bilibili 图床或已有后缀时原样返回。
 */
export function avatarThumb(url: string | undefined, size = '100w_100h'): string {
  if (!url) return ''
  if (!/^https?:\/\/[^/]*hdslb\.com\//.test(url)) return url
  return url.includes('@') ? url : `${url}@${size}.webp`
}
