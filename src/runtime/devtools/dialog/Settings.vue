<script setup lang="ts">
import { NButton, NSelect, NSwitch, NTable, NText } from 'naive-ui'
import { badgePositions, resetSettings, settings } from '../shared'
</script>

<template>
  <NTable>
    <tbody>
      <tr>
        <td><NText strong>Viewport badge on the page</NText></td>
        <td><NSwitch v-model:value="settings.badge" /></td>
      </tr>
      <tr>
        <td><NText strong>Badge position</NText></td>
        <td>
          <NSelect
            v-model:value="settings.badgePosition"
            size="small"
            :options="badgePositions.map((p) => ({ label: p, value: p }))"
          />
        </td>
      </tr>
      <tr>
        <td><NText strong>Dark mode (this tab)</NText></td>
        <td><NSwitch v-model:value="settings.darkMode" /></td>
      </tr>
      <tr>
        <td colspan="2"><NButton size="small" @click="resetSettings">Reset settings</NButton></td>
      </tr>
    </tbody>
  </NTable>
</template>
