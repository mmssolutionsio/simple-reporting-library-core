<script setup lang="ts">
import { pageConnected, useSrlConfig, useViewPort } from '../state'

const srlConfig = useSrlConfig()
const viewPort = useViewPort()
</script>

<template>
  <div v-if="!pageConnected" class="srl-dt-alert">
    The width of the page appears once the page is open (in <code>srl dev</code>, not in the DevTools popup window).
  </div>
  <table class="srl-dt-table">
    <tbody>
      <tr>
        <td>window.innerWidth</td>
        <td>{{ viewPort.innerWidth }}px</td>
      </tr>
      <tr>
        <td>Viewport</td>
        <td>{{ viewPort.viewPort ?? '–' }}</td>
      </tr>
    </tbody>
  </table>
  <h2 style="margin-top: 18px">Breakpoints</h2>
  <table class="srl-dt-table">
    <tbody>
      <tr v-for="(value, breakpoint) in srlConfig.grid?.breakpoints ?? {}" :key="breakpoint">
        <td :class="{ 'is-current': breakpoint === viewPort.viewPort }">{{ breakpoint }}</td>
        <td>{{ value }}px</td>
      </tr>
    </tbody>
  </table>
</template>
