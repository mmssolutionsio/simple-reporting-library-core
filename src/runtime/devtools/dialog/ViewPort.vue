<script setup lang="ts">
import { pageConnected, useViewPort, useSrlConfig } from '../state'
import { NAlert, NTable, NH2, NText } from 'naive-ui'

const srlConfig = useSrlConfig()
const viewPort = useViewPort()
</script>

<template>
  <NAlert v-if="!pageConnected" type="info" :bordered="false" style="margin-bottom: 12px">
    Width of the page appears once the page is open (srl dev, not in the DevTools popup window).
  </NAlert>
  <NTable striped>
    <tbody>
      <tr>
        <td>window.innerWidth</td>
        <td v-text="viewPort.innerWidth" />
      </tr>
      <tr>
        <td>ViewPort</td>
        <td v-text="viewPort.viewPort" />
      </tr>
    </tbody>
  </NTable>
  <NH2>Breakpoints</NH2>
  <NTable striped>
    <tbody>
      <tr v-for="(value, breakpoint) in srlConfig.grid.breakpoints" :key="breakpoint">
        <td>
          <NText strong v-text="breakpoint" :type="breakpoint === viewPort.viewPort?'error':'default'"></NText>
        </td>
        <td v-text="value" />
      </tr>
    </tbody>
  </NTable>
</template>