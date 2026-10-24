import { DEFAULT_THEME } from '@/config'

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const v = Number.parseInt(full, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function triplet(rgb: Rgb): string {
  return rgb.map((c) => Math.round(c)).join(' ')
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function luminance(rgb: Rgb): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}

function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]
const DARK_CARD: Rgb = [30, 30, 48] // #1E1E30 暗色卡片底

/** 向黑色混合直到与背景对比达标,返回最深可用色 */
function darkenUntil(brand: Rgb, bg: Rgb, min = 4.5): Rgb {
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed = mix(brand, BLACK, t)
    if (contrast(mixed, bg) >= min) return mixed
  }
  return BLACK
}

/** 向白色混合直到与背景对比达标,返回最浅可用色 */
function lightenUntil(brand: Rgb, bg: Rgb, min = 4.5): Rgb {
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed = mix(brand, WHITE, t)
    if (contrast(mixed, bg) >= min) return mixed
  }
  return WHITE
}

/**
 * 把主播主题色应用到 documentElement 行内样式(覆盖 tokens.css 的 :root/.dark)。
 * 只需一个种子色:品牌紫上的文字色、浅底可读文字色、页面底色/过渡层均自动派生,
 * 并保证 WCAG AA(≥4.5:1);未配置主题时清除行内样式,回落到 tokens.css 默认值。
 */
export function applyStreamerTheme(theme: string | undefined, dark: boolean): void {
  const root = document.documentElement

  // 未配置时使用默认种子色,派生逻辑与自定义主题完全一致
  const seed = theme && /^#?[0-9a-f]{3,8}$/i.test(theme.trim()) ? theme.trim() : DEFAULT_THEME
  const brand = hexToRgb(seed)

  // 主色填充/装饰
  root.style.setProperty('--brand', triplet(brand))

  // 浅底上的可读文字色:亮色模式加深、暗色模式提亮,直至对比 ≥4.5:1
  const strong = dark ? lightenUntil(brand, DARK_CARD) : darkenUntil(brand, WHITE)
  root.style.setProperty('--brand-strong', triplet(strong))

  // 品牌紫填充上的文字:在「深墨」与「白」之间取对比更高者
  const darkInk = darkenUntil(brand, brand)
  const onBrand = contrast(darkInk, brand) >= contrast(WHITE, brand) ? darkInk : WHITE
  root.style.setProperty('--on-brand', triplet(onBrand))

  // 页面底与过渡层:向品牌色同源调浅/调暗,让整个页面染上主播色调
  const bgBase = dark ? mix(brand, BLACK, 0.9) : mix(brand, WHITE, 0.9)
  root.style.setProperty('--bg-base', triplet(bgBase))
  root.style.setProperty('--bg-scrim', triplet(dark ? mix(brand, BLACK, 0.94) : mix(brand, WHITE, 0.92)))

  setThemeColor(`rgb(${triplet(bgBase)})`)
}

function setThemeColor(color: string): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}
