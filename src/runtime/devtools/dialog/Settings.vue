<script setup lang="ts">
import { badgePositions, resetSettings, settings } from '../shared'
import Switch from '../ui/Switch.vue'
</script>

<template>
  <table class="srl-dt-table">
    <tbody>
      <tr>
        <td>Viewport badge on the page (click toggles the grid)</td>
        <td><Switch v-model="settings.badge" /></td>
      </tr>
      <tr>
        <td>Badge position</td>
        <td>
          <select v-model="settings.badgePosition">
            <option v-for="position in badgePositions" :key="position" :value="position">{{ position }}</option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Theme of this tab</td>
        <td>
          <select v-model="settings.theme">
            <option value="auto">auto (Nuxt DevTools)</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </td>
      </tr>
    </tbody>
  </table>
  <p><button type="button" class="srl-dt-button" @click="resetSettings">Reset settings</button></p>
</template>
