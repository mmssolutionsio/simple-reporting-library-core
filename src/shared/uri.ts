// Ported from SRL 1 srl/.srl/utils/uri.ts.
const FILE_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|zip|html?|php|aspx?|jsp|xml|json|txt|svg|png|jpe?g|gif|webp|mp4)$/i
const EXTERNAL_PREFIXES = /^(https?:|\/\/|mailto:|tel:|sms:|callto:|skype:|sip:|wss?:|irc:|gopher:|whatsapp:|javascript:)/i

export function isFilePath(path: string): boolean {
  return FILE_EXTENSIONS.test(path.split(/[?#]/)[0] ?? '')
}

export function isExternalPath(path: string): boolean {
  return EXTERNAL_PREFIXES.test(path)
}

export function isRouterPath(path: string): boolean {
  return ((path.startsWith('/') && !path.startsWith('//')) || path.startsWith('./')) && !isFilePath(path)
}
