// Entry of the SRL tab page (/__srl-devtools, served by the module in `srl dev`).
import { createApp } from 'vue'
import { trackViewport } from '../state'
import Tab from './Tab.vue'

trackViewport('tab')
createApp(Tab).mount('#app')
