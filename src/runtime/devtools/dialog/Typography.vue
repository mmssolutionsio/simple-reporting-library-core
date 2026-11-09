<script setup lang="ts">
// New in SRL 2: the typography styles of srl.config with a sample. The sample uses the CSS custom
// properties of the page (--srl-typo-<name>-*, responsive), falling back to the config values.
import { computed, ref } from 'vue'
import { NFlex, NH2, NInput, NTable, NTag, NText } from 'naive-ui'
import { useSrlConfig } from '../state'

type MediaValue = Record<string, string | number>
type TypoStyle = Record<string, unknown> & {
  name: string
  media?: Record<string, MediaValue | Record<string, MediaValue>>
}

const srlConfig = useSrlConfig()
const sampleText = ref('The quick brown fox jumps over the lazy dog 0123456789')

const PROPERTIES = ['font-family', 'font-size', 'line-height', 'font-weight', 'font-style', 'letter-spacing', 'text-transform'] as const

const styles = computed<TypoStyle[]>(() => srlConfig.value.typography?.typography ?? [])
const defaultFont = computed<string | undefined>(() => srlConfig.value.fonts?.['default-font'])

/** Numbers are px in srl.config (like the SCSS size-unit). */
function size(value: unknown): string {
  return typeof value === 'number' ? `${value}px / ${value / 16}rem` : String(value)
}

function cssValue(property: string, value: unknown): string {
  if (typeof value !== 'number') return String(value)
  return ['font-size', 'letter-spacing'].includes(property) ? `${value / 16}rem` : String(value)
}

function sampleStyle(style: TypoStyle): Record<string, string> {
  const css: Record<string, string> = {}
  for (const property of PROPERTIES) {
    const fallback = style[property]
    const variable = `var(--srl-typo-${style.name}-${property}${fallback === undefined ? '' : `, ${cssValue(property, fallback)}`})`
    css[property] = variable
  }
  return css
}

/** media.up/down/only entries as "up tablet-pt: font-size 36px" lines. */
function mediaLines(style: TypoStyle): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(style.media ?? {})) {
    const groups = ['up', 'down'].includes(key) ? Object.entries(value as Record<string, MediaValue>) : [[key, value as MediaValue]]
    for (const [breakpoint, values] of groups as Array<[string, MediaValue]>) {
      const prefix = ['up', 'down'].includes(key) ? `${key} ${breakpoint}` : breakpoint
      lines.push(`${prefix}: ${Object.entries(values).map(([p, v]) => `${p} ${size(v)}`).join(', ')}`)
    }
  }
  return lines
}
</script>

<template>
  <NFlex vertical>
    <NText v-if="defaultFont">
      default-font: <NText code>{{ defaultFont }}</NText>
    </NText>
    <NInput v-model:value="sampleText" size="small" placeholder="Sample text" />
    <div v-for="style in styles" :key="style.name" class="typo">
      <NFlex align="center" justify="space-between">
        <NH2 class="typo__name">{{ style.name }}</NH2>
        <NFlex size="small">
          <NTag v-if="style['font-size'] !== undefined" size="small">{{ size(style['font-size']) }}</NTag>
          <NTag v-if="style['line-height'] !== undefined" size="small">lh {{ style['line-height'] }}</NTag>
          <NTag v-if="style['font-weight'] !== undefined" size="small">{{ style['font-weight'] }}</NTag>
        </NFlex>
      </NFlex>
      <div class="typo__sample" :style="sampleStyle(style)">{{ sampleText }}</div>
      <NTable v-if="mediaLines(style).length" size="small" striped>
        <tbody>
          <tr v-for="line in mediaLines(style)" :key="line">
            <td>{{ line }}</td>
          </tr>
        </tbody>
      </NTable>
    </div>
  </NFlex>
</template>

<style scoped>
.typo {
  padding-block: 8px;
  border-bottom: 1px solid #00000014;
}
.typo__name {
  margin: 0;
  font-size: 13px;
}
.typo__sample {
  margin-block: 6px;
  overflow-wrap: anywhere;
}
</style>
