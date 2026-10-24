/** 歌曲原始结构,与远端数据源(qylive)字段一致,直接消费不做转换 */
export interface Song {
  title: string
  singer: string
  lang: string
  genre?: string
  style?: string
  /** 点歌需要的 SuperChat 金额,空串/0/缺省表示无 SC */
  sc?: number | string
  /** 备注原文(模板「备注」列),页面暂不展示 */
  remark?: string
  /** 运行时按行序生成(1 起),仅用作 key 与随机排序,与外部编号无关 */
  id: number
}

/** 主播个性化配置与数据,存于 public/data/<id>.json */
export interface StreamerMeta {
  /** 页面标题(浏览器标签页 + 侧栏) */
  title: string
  subtitle?: string
  /** 主播头像 URL,缺省显示音符图标 */
  avatar?: string
  /** 背景图:移动端与宽屏各一张,路径相对站点根 */
  bg?: { mobile?: string; desktop?: string }
  /** 点歌口令模板,占位符 {title} {singer} {lang} {tags} */
  orderTemplate?: string
  /** 唱片机点击跳转的主播主页 */
  streamerUrl?: string
  /** 主题种子色(hex),派生配色自动计算;缺省用默认 #1677FF */
  theme?: string
  /** 歌曲数据更新日期,显示在页脚 */
  songsUpdatedAt?: string
}

/** 筛选 tag:kind 区分语种/类型两个维度 */
export interface FilterTag {
  name: string
  count: number
  kind: 'language' | 'genre'
}
