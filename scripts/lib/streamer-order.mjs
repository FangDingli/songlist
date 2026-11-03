/**
 * 首页「入驻主播」板块的集中式排序:
 * order.json 为 id 数组,数组序即展示序;未列出的主播按 id 字典序垫底。
 * 改顺序只需重排该数组,无需逐个改各主播的 config.json。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 读取排序清单(可选文件,缺省返回空数组) */
export function readStreamerOrder(stagingDir) {
  const p = resolve(stagingDir, 'order.json')
  if (!existsSync(p)) return []
  try {
    const list = JSON.parse(readFileSync(p, 'utf8'))
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    console.warn(`order.json 解析失败,忽略(按 id 字典序排序)`)
    return []
  }
}

/** 按清单序排序:列出的按位置在前,未列出的按 id 字典序垫底(原地排序并返回) */
export function applyStreamerOrder(streamers, orderList) {
  const idx = new Map(orderList.map((id, i) => [id, i]))
  return streamers.sort((a, b) => {
    const ia = idx.get(a.id)
    const ib = idx.get(b.id)
    if (ia !== undefined || ib !== undefined) {
      return (ia ?? Infinity) - (ib ?? Infinity)
    }
    return a.id.localeCompare(b.id)
  })
}
