#!/usr/bin/env node
// Transpiles src/ to dist/ (.mjs + .d.ts, Vue SFCs without TypeScript). Nitro does not
// transpile TypeScript from node_modules, so the published package must contain JavaScript.
import { rmSync } from 'node:fs'
import { mkdist } from 'mkdist'

const root = import.meta.dirname
rmSync(`${root}/dist`, { recursive: true, force: true })
const result = await mkdist({ rootDir: root, srcDir: 'src', distDir: 'dist', ext: 'mjs', declaration: true })
const errors = result.errors ?? []
for (const error of errors) console.error(error.filename, error.errors)
console.log(`dist: ${result.writtenFiles.length} files${errors.length ? `, ${errors.length} declaration errors` : ''}`)
if (errors.length) process.exit(1)
