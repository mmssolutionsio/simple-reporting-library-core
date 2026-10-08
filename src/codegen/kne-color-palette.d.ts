declare module '@kne/color-palette' {
  /** ant.design colour palette: step 0.5…9.5 from light to dark, returns a hex string. */
  export default function colorPalette(color: string, index: number, format?: string): string
}
