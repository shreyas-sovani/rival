function isStripped(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfeff
  );
}

/** Plain text for display. Never HTML. Truncates with an ellipsis at `max` characters. */
export function sanitizeDisplayText(input: string, max: number): string {
  if (max < 0) throw new Error("max must be >= 0");
  let stripped = "";
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (isStripped(code) || char === "<" || char === ">") continue;
    stripped += char;
  }
  const plain = stripped.normalize("NFC");
  if (plain.length <= max) return plain;
  if (max === 0) return "";
  if (max === 1) return "…";
  return `${plain.slice(0, max - 1)}…`;
}
