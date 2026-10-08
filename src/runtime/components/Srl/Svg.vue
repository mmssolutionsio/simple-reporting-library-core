<script lang="ts">
/**
 * `SrlSvg` – renders an SVG given as markup / data URI (also on the server), as URL (fetched in
 * the browser) or as component/VNode. Attributes (class, aria-*) go to the <svg>.
 * Render function (not a template) so the SSR output keeps the case of `viewBox`.
 */
import { computed, defineComponent, h, onMounted, ref, watch, type Component, type PropType } from 'vue'
import { isInlineSvg, parseSvg, type ParsedSvg } from '../../utils/svg'

export default defineComponent({
  name: 'SrlSvg',
  inheritAttrs: false,
  props: {
    svg: { type: [String, Object, Function] as PropType<string | object>, required: false },
  },
  setup(props, { attrs }) {
    const loaded = ref<ParsedSvg>()
    const parsed = computed(() =>
      typeof props.svg === 'string' && isInlineSvg(props.svg) ? parseSvg(props.svg) : loaded.value,
    )

    async function load() {
      loaded.value = undefined
      if (typeof props.svg !== 'string' || isInlineSvg(props.svg)) return
      try {
        const response = await fetch(props.svg)
        if (response.ok) loaded.value = parseSvg(await response.text())
      } catch {
        // keep empty, like SRL 1
      }
    }

    onMounted(() => {
      void load()
      watch(() => props.svg, load)
    })

    return () => {
      if (parsed.value) return h('svg', { ...parsed.value.attrs, ...attrs, innerHTML: parsed.value.inner })
      if (props.svg && typeof props.svg === 'object') return h(props.svg as Component, attrs)
      return null
    }
  },
})
</script>
