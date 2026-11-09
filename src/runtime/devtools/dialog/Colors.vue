<script setup lang="ts">
import { computed } from 'vue'
import { useSrlConfig } from '../state'

const srlConfig = useSrlConfig()
const colors = computed<Array<{ name: string; color: string; description?: string }>>(() => srlConfig.value.colors?.colors ?? [])
</script>

<template>
  <table class="srl-dt-table">
    <tbody>
      <tr v-for="item in colors" :key="item.name">
        <td><code>{{ item.name }}</code></td>
        <td>
          <span class="srl-dt-row">
            <span class="swatch" :style="{ backgroundColor: item.color }" />
            <code>{{ item.color }}</code>
          </span>
        </td>
        <td class="srl-dt-muted">{{ item.description ?? '' }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.swatch {
  width: 28px;
  height: 28px;
  border: 1px solid #00000020;
  border-radius: 4px;
}
</style>
