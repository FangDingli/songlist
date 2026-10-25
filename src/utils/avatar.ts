/**
 * bilibili 图床缩略图:头像原图很大,缩到小尺寸会锯齿,
 * 追加 @<size>.webp 后缀让 CDN 直接出小图;非 bilibili 图床或已有后缀时原样返回。
 */
export function avatarThumb(url: string | undefined, size = '100w_100h'): string {
  if (!url) return ''
  if (!/^https?:\/\/[^/]*hdslb\.com\//.test(url)) return url
  return url.includes('@') ? url : `${url}@${size}.webp`
}
