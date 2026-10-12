export function findInlineEquations(text) {
  const equations = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "$" || text[start - 1] === "\\" || text[start + 1] === "$") continue;
    for (let end = start + 1; end < text.length; end += 1) {
      if (text[end] === "\n") break;
      if (text[end] === "\\") {
        end += 1;
        continue;
      }
      if (text[end] === "$" && text[end + 1] !== "$") {
        equations.push({ source: text.slice(start, end + 1) });
        start = end;
        break;
      }
    }
  }
  return equations;
}
