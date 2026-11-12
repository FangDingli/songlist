<script setup lang="ts">
import AvatarImage from './AvatarImage.vue'

const props = defineProps<{
  /** 静态头像地址,动态解析失败时的兜底 */
  avatar?: string
  /** 主播 uid,存在时通过解析服务动态获取(跟随 B 站头像更新) */
  uid?: string
  /** 手动指定头像:true 时只用静态 avatar,不通过 uid 动态解析 */
  avatarManual?: boolean
  /** 点击跳转的直播间,缺省则不可点击 */
  href?: string
}>()
</script>

<template>
  <component
    :is="props.href ? 'a' : 'div'"
    :href="props.href"
    :target="props.href ? '_blank' : undefined"
    :rel="props.href ? 'noopener noreferrer' : undefined"
    :title="props.href ? '进入直播间' : undefined"
    class="block cursor-pointer transition-opacity duration-200 hover:opacity-80"
  >
    <div class="flex-center p-8px">
      <div
        class="relative w-140px h-140px rounded-full border-3 border-brand-light flex-center animate-disc motion-reduce:animate-none"
      >
        <AvatarImage
          :uid="props.uid"
          :avatar="props.avatar"
          :avatar-manual="props.avatarManual"
          icon-class="text-36px"
          class="w-110px h-110px border-4 border-bg-card"
          alt="主播头像"
        />
        <div class="absolute top-8px left-1/2 -translate-x-1/2 w-10px h-10px rounded-full bg-brand"></div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.animate-disc {
  animation: disc-spin 12s linear infinite;
}
@keyframes disc-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
