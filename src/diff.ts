export type DiffSpan = {
  kind: "equal" | "added" | "removed";
  text: string;
};

function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

/**
 * Computes a word-and-whitespace diff suitable for inline review of AI rewrites.
 * Falls back to whole-string replacement if token counts exceed bounded LCS size.
 */
export function computeWordDiff(
  original: string,
  proposed: string,
): DiffSpan[] {
  if (original === proposed) {
    return original ? [{ kind: "equal", text: original }] : [];
  }
  if (!original) {
    return [{ kind: "added", text: proposed }];
  }
  if (!proposed) {
    return [{ kind: "removed", text: original }];
  }

  const left = tokenizeWords(original);
  const right = tokenizeWords(proposed);
  if (left.length * right.length > 90_000) {
    return [
      { kind: "removed", text: original },
      { kind: "added", text: proposed },
    ];
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const table = new Uint16Array(rows * cols);

  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        left[i] === right[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  const raw: DiffSpan[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      raw.push({ kind: "equal", text: left[i] });
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      raw.push({ kind: "removed", text: left[i] });
      i++;
    } else {
      raw.push({ kind: "added", text: right[j] });
      j++;
    }
  }
  while (i < left.length) {
    raw.push({ kind: "removed", text: left[i++] });
  }
  while (j < right.length) {
    raw.push({ kind: "added", text: right[j++] });
  }

  const merged: DiffSpan[] = [];
  for (const span of raw) {
    const previous = merged[merged.length - 1];
    if (previous && previous.kind === span.kind) {
      previous.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}
