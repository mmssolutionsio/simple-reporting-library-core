<script setup lang="ts">
import { resetBadgePosition, resetSettings, settings } from '../shared'
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
        <td>Badge position <span class="srl-dt-muted">(drag the badge, it snaps to the nearest edge)</span></td>
        <td>
          <span class="srl-dt-muted">{{ settings.badgeSide }} · {{ settings.badgeOffset }}%</span>
          <button type="button" class="srl-dt-button" style="margin-left: 8px" @click="resetBadgePosition">Reset</button>
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
