/** 歌曲原始结构,与远端数据源(qylive)字段一致,直接消费不做转换 */
export interface Song {
  title: string
  singer: string
  lang: string
  /** 类型,多值可用中英文分号/逗号/顿号/斜杠分隔,页面端拆成 tag;所有转换脚本只写此字段 */
  genre?: string
  /** 点歌需要的 SuperChat 金额,空串/0/缺省表示无 SC */
  sc?: number | string
  /** 付费/SC 备注(模板「付费」列),如「30SC」「舰长」;空表示无需 */
  paid?: string
  /** 备注原文,页面暂不展示 */
  remark?: string
  /** B 站视频 BV 号(歌曲演示),页面暂未使用 */
  video?: string
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
  /** 手动指定头像:true 时只用 avatar 静态地址,不通过 uid 动态解析 */
  avatarManual?: boolean
  /** 背景图:移动端与宽屏各一张,路径相对站点根 */
  bg?: { mobile?: string; desktop?: string }
  /** 手机端默认列数(1 或 2),缺省 1;观众可在顶栏临时覆盖(按主播记在 localStorage) */
  mobileCols?: 1 | 2
  /** 点歌口令模板,占位符 {title} {singer} {lang} {tags} */
  orderTemplate?: string
  /** 主播 B 站 UID,与 userProfileUrl 同源 */
  uid?: string
  /** 直播间 ID,与 liveUrl 同源 */
  liveroomId?: string
  /** 主播主页,由 uid 派生:https://space.bilibili.com/<uid>(唱片机点击跳转) */
  userProfileUrl?: string
  /** 直播间链接,由 liveroomId 派生:https://live.bilibili.com/<liveroomId> */
  liveUrl?: string
  /** 站点 favicon,缺省使用头像 */
  favicon?: string
  /** 主题种子色(hex),派生配色自动计算;缺省用默认 #1677FF */
  theme?: string
  /** 强制使用原色做主色(excel 主题色加「!」前缀);其余梯度色仍按适合性调整色派生 */
  themeForced?: boolean
  /** 歌曲数据更新日期,显示在页脚 */
  songsUpdatedAt?: string
  /** 访问别名(如中文路径),命中后按真实 id 加载数据,URL 保持别名不变 */
  aliases?: string[]
  /** 首页「入驻主播」板块的展示顺序,数字越小越靠前;缺省按 id 字典序兜底 */
  order?: number
}

/** 筛选 tag:kind 区分语种/类型/付费维度(付费与免费成对出现) */
export interface FilterTag {
  name: string
  count: number
  kind: 'language' | 'genre' | 'paid' | 'free'
}
