/** Converts Arabic-Indic (U+0660-0669) and Persian (U+06F0-06F9) digits to 0-9. */
export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}
