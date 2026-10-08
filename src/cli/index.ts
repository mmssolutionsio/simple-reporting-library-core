import { defineCommand, runMain } from 'citty'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

export const srl = defineCommand({
  meta: { name: 'srl', version: pkg.version, description: 'Simple Reporting Library 2' },
  subCommands: {
    dev: () => import('./commands/dev').then((m) => m.default),
    build: () => import('./commands/build').then((m) => m.default),
    data: () => import('./commands/data').then((m) => m.default),
    add: () => import('./commands/livingdocs').then((m) => m.add),
    remove: () => import('./commands/livingdocs').then((m) => m.remove),
    create: () => import('./commands/livingdocs').then((m) => m.create),
    livingdocs: () => import('./commands/livingdocs').then((m) => m.default),
    update: () => import('./commands/update').then((m) => m.default),
    doctor: () => import('./commands/doctor').then((m) => m.default),
  },
})

/** Exits with code 1 on every error (SRL 1 always exited with 0). */
export function main() {
  return runMain(srl)
}
