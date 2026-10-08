#!/usr/bin/env node
// Runs the TypeScript CLI directly (workspace development). The published package ships the built file.
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { main } = await jiti.import('../src/cli/index.ts')
await main()
