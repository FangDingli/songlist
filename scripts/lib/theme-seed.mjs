/**
 * 主题色种子色的适合性判断与梯度计算,供各转换脚本共用。
 *
 * 用户填写的「主题色」经常是取自图片的浅色/淡色(如背景色 #f8e8d4、奶油色),
 * 直接做主色种子会导致品牌色发虚。规则:
 * - 近中性色(饱和度 < 0.15)保持原样——灰黑白本身是合理种子
 * - 其余提升饱和度至 ≥0.5、亮度限制在 0.45~0.62,保证种子色有足够分量
 * (最终可读性/WCAG AA 由 src/utils/theme.ts 在运行时派生保证,此处只管种子)
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const v = Number.parseInt(full, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToHex([h, s, l]) {
  const hue = (v) => {
    v = ((v % 1) + 1) % 1
    return v < 1 / 6 ? v * 6 : v < 1 / 2 ? 1 : v < 2 / 3 ? (2 / 3 - v) * 6 : 0
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const rgb = [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => Math.round((p + (q - p) * v) * 255))
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')
}

/** 主题色 → 适合做主色种子的色值;返回 null 表示无需处理(缺省/非法输入由调用方决定) */
export function deriveSeed(color) {
  if (!/^[0-9a-f]{3,8}$/i.test(String(color).replace('#', '').trim())) return color
  const [h, s, l] = rgbToHsl(hexToRgb(color))
  if (s < 0.15) return String(color).trim()
  return hslToHex([h, Math.max(s, 0.5), Math.min(0.62, Math.max(0.45, l))])
}
