#!/usr/bin/env node
import { existsSync } from 'node:fs'

// Published package: built CLI. Workspace without build: run the TypeScript source via jiti.
const built = new URL('../dist/cli/index.mjs', import.meta.url)
const { main } = existsSync(built)
  ? await import(built.href)
  : await (await import('jiti')).createJiti(import.meta.url).import('../src/cli/index.ts')
await main()
