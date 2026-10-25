<script setup lang="ts">
defineProps<{
  label: string
  count?: number
  selected: boolean
}>()

defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <!-- hover 变色仅未选中时应用:选中底为品牌实底,brand-strong 文字会与底色同化 -->
  <button type="button" class="tag-pill" :class="selected ? 'tag-pill-selected' : 'tag-pill-hover'"
    @click="$emit('toggle')">
    {{ label }}
    <span v-if="count !== undefined" class="ml-4px text-12px opacity-60">{{ count }}</span>
  </button>
</template>
