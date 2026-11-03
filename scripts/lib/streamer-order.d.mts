// streamer-order.mjs 的类型声明(vite.config.ts 引用)
export declare function readStreamerOrder(stagingDir: string): string[]
export declare function applyStreamerOrder<T extends { id: string }>(
  streamers: T[],
  orderList: string[],
): T[]
