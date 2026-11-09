<script setup lang="ts">
import { useSrlConfig } from '../state'
import { computed } from 'vue'

const srlConfig = useSrlConfig()

type SpacerItem = {
  name: string
  size: number | string
  alias: string | null
  only?: SpacerItemMedia[]
  up?: SpacerItemMedia[]
  down?: SpacerItemMedia[]
}

type SpacerItemMedia = {
  name: string
  size: number | string
}

const px = (size: number | string) => (typeof size === 'number' ? `${size}px / ${size / 16}rem` : size)

const spacerView = computed<SpacerItem[]>(() => {
  const res = []
  for (const [key, item] of Object.entries(srlConfig.value.spacer.spacer)) {
    const i: SpacerItem = {
      name: key,
      size: item.size,
      alias: item.alias??null,
    }

    if (item.media) {
      for (const [media, value] of Object.entries(item.media)) {
        if (['up', 'down'].includes(media)) {
          for (const [m, s] of Object.entries(value as object)) {
            if (!i[media]) { i[media] = [] }
            i[media].push({
              name: m,
              size: s.size ?? s,
            })
          }
        } else {
          if (!i.only) { i.only = [] }
          i.only.push({
            name: media,
            size: value.size ?? value,
          })
        }
      }
    }

    res.push(i)
  }

  return res;
})

</script>

<template>
  <div class="srl-dt-cards">
    <section v-for="item in spacerView" :key="item.name">
      <h2>
        {{ item.name }}
        <span v-if="item.alias" class="srl-dt-muted">({{ item.alias }})</span>
      </h2>
      <table class="srl-dt-table">
        <tbody>
          <tr>
            <td>size</td>
            <td colspan="2" v-text="px(item.size)" />
          </tr>
          <template v-for="group in (['only', 'up', 'down'] as const)" :key="group">
            <tr v-for="(entry, index) in item[group] ?? []" :key="group + entry.name">
              <td v-if="index === 0" class="v-top" :rowspan="item[group]!.length">{{ group }}</td>
              <td>{{ entry.name }}</td>
              <td v-text="px(entry.size)" />
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.v-top {
  vertical-align: top;
}
</style>