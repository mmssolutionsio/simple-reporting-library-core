import { spawn } from 'node:child_process'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { isInteractive, logger, projectRoot, readAlternative, writeAlternative } from '../context'
import { notifyUpdates } from './update'

/** Asks once for the alternative livingdocs package (stored in srl.config). */
export async function ensureLivingdocsChoice(root: string) {
  if ((await readAlternative(root)) !== undefined) return
  if (!isInteractive()) {
    logger.warn('No livingdocs source chosen; using the standard package only. Set one with: npx srl livingdocs source <pkg|none>')
    return
  }
  const answer = await p.text({
    message: 'Alternative livingdocs package (npm name, empty for none)',
    placeholder: '@acme/livingdocs',
    defaultValue: '',
  })
  if (p.isCancel(answer)) return
  await writeAlternative(root, answer.trim() || null)
}

export function runNuxt(root: string, args: string[], env: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['nuxt', ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`nuxt ${args[0]} exited with code ${code}`))))
  })
}

export default defineCommand({
  meta: { name: 'dev', description: 'Start the development server' },
  args: {
    preview: { type: 'boolean', description: 'Client-only preview mode (data loaded at runtime)' },
    port: { type: 'string', description: 'Port' },
  },
  async run({ args }) {
    const root = projectRoot()
    await ensureLivingdocsChoice(root)
    await notifyUpdates(root)
    await runNuxt(root, ['dev', ...(args.port ? ['--port', args.port] : [])], args.preview ? { SRL_MODE: 'preview' } : {})
  },
})
