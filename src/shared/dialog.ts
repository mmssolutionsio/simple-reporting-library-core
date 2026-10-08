/** Articles that are only shown as dialogs (notes), e.g. `notes-group-12`. They get no route. */
export const DIALOG_PATTERN = /^notes-[a-z0-9]+-\d+$/

export function isDialogArticle(uuid: string, pattern: RegExp = DIALOG_PATTERN): boolean {
  return pattern.test(uuid)
}
