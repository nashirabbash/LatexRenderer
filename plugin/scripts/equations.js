function isEscaped(text, index) {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function getOpeningDelimiter(text, index) {
  if (isEscaped(text, index)) return null;
  if (text.startsWith("$$", index)) return { delimiter: "$$", display: true };
  if (text.startsWith("\\(", index)) return { delimiter: "\\)", display: false };
  if (text.startsWith("\\[", index)) return { delimiter: "\\]", display: true };
  if (text[index] === "$") return { delimiter: "$", display: false };
  return null;
}

function findClosingDelimiter(text, start, delimiter) {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "\n" && delimiter.length === 1) return -1;
    if (!text.startsWith(delimiter, index) || isEscaped(text, index)) continue;
    if (delimiter === "$" && text[index + 1] === "$") continue;
    return index;
  }
  return -1;
}

export function findMarkedEquations(text) {
  const equations = [];
  for (let start = 0; start < text.length; start += 1) {
    const opening = getOpeningDelimiter(text, start);
    if (!opening) continue;
    const closing = findClosingDelimiter(text, start + opening.delimiter.length, opening.delimiter);
    if (closing < 0) continue;
    const end = closing + opening.delimiter.length;
    equations.push({
      source: text.slice(start, end),
      latex: text.slice(start + opening.delimiter.length, closing),
      display: opening.display,
      start,
    });
    start = end - 1;
  }
  return equations;
}
