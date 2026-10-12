import { beforeEach, expect, mock, test } from "bun:test";
import { makeButton, makeRange, setupDocument } from "./editor-document.js";

const callEditor = mock((command) => command());
mock.module("../plugin/scripts/editor.js", () => ({ callEditor }));

const { attachRenderAction } = await import("../plugin/scripts/render.js");
const { attachDerenderActions } = await import("../plugin/scripts/derender.js");

let document;
let regions;
beforeEach(() => {
  ({ document, regions } = setupDocument());
  callEditor.mockClear();
});

test("renders equations in body, table, header, and footer, then restores them all", async () => {
  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("Body $unfinished\n\\$5 [a] [b] [c] [d]");
  expect(regions.table.text).toBe("Table $unfinished\n\\$5 [a] [b] [c] [d]");
  expect(regions.header.text).toBe("Header $unfinished\n\\$5 [a] [b] [c] [d]");
  expect(regions.footer.text).toBe("Footer $unfinished\n\\$5 [a] [b] [c] [d]");
  expect(document.displayBreaks).toBe(12);

  const selection = makeButton();
  const all = makeButton();
  attachDerenderActions(selection, all);
  await all.click();

  expect(regions.body.text).toBe("Body $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.table.text).toBe("Table $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.header.text).toBe("Header $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.footer.text).toBe("Footer $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
});

test("de-renders only selected plugin equation from any supported region", async () => {
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
  const selection = makeButton();
  const all = makeButton();
  attachDerenderActions(selection, all);
  for (const region of Object.keys(regions)) {
    const paragraph = regions[region];
    const selectedBookmark = [...document.bookmarks.keys()].find((name) => document.bookmarks.get(name).paragraph === paragraph);
    const selectedSource = document.properties.get(selectedBookmark);
    const latexStart = selectedSource.startsWith("$$") || selectedSource.startsWith("\\") ? 2 : 1;
    const before = Object.fromEntries(Object.entries(regions).map(([name, value]) => [name, value.text]));
    const renderedEquation = `[${selectedSource.slice(latexStart, -latexStart)}]`;
    document.currentRange = document.GetBookmarkRange(selectedBookmark);
    await selection.click();
    expect(paragraph.text).toBe(before[region].replace(renderedEquation, selectedSource));
    for (const [name, value] of Object.entries(regions)) {
      if (name !== region) expect(value.text).toBe(before[name]);
    }
  }
});

test("de-renders a selected equation when range intersection misses an overlapping range", async () => {
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
  const name = [...document.bookmarks.keys()].find((bookmarkName) => document.bookmarks.get(bookmarkName).paragraph === regions.body);
  const bookmark = document.bookmarks.get(name);
  const before = regions.body.text;
  const selectedSource = document.properties.get(name);
  const delimiterLength = selectedSource.startsWith("$$") || selectedSource.startsWith("\\") ? 2 : 1;
  const renderedEquation = `[${selectedSource.slice(delimiterLength, -delimiterLength)}]`;
  const getBookmarkRange = document.GetBookmarkRange;
  document.GetBookmarkRange = (bookmarkName) => {
    const range = getBookmarkRange(bookmarkName);
    if (range) range.IntersectWith = () => null;
    return range;
  };
  document.currentRange = makeRange(bookmark.paragraph, bookmark.start, renderedEquation, renderedEquation.length);

  const selection = makeButton();
  const all = makeButton();
  attachDerenderActions(selection, all);
  await selection.click();

  expect(regions.body.text).toBe(before.replace(renderedEquation, selectedSource));
});

test("keeps marked source when editor rejects an equation", async () => {
  regions.body.text = "Before $unsupported$ after $valid$";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const insert = document.AddMathEquation;
  document.AddMathEquation = (latex) => latex === "unsupported" ? false : insert(latex);
  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("Before $unsupported$ after [valid]");
});

test("restores failed source and continues after editor throws without logging LaTeX", async () => {
  regions.body.text = "Before $unsupported_secret$ after $valid$";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const insert = document.AddMathEquation;
  document.AddMathEquation = (latex) => {
    if (latex === "unsupported_secret") throw new SyntaxError("invalid $unsupported_secret$");
    return insert(latex);
  };
  const errors = [];
  const originalError = console.error;
  console.error = (message) => errors.push(String(message));
  try {
    const render = makeButton();
    attachRenderAction(render);
    await render.click();
  } finally {
    console.error = originalError;
  }

  expect(regions.body.text).toBe("Before $unsupported_secret$ after [valid]");
  expect(errors.join("\n")).not.toContain("unsupported_secret");
  expect(errors.some((entry) => entry.includes('"exception":1'))).toBe(true);
});

test("replaces marked source when editor inserts math beside selected text", async () => {
  regions.body.text = "Result $a^2+b^2=c^2$ end";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  document.AddMathEquation = (latex) => {
    const paragraph = regions.body;
    const start = document.cursor ?? document.selected.GetEndPos();
    paragraph.text = paragraph.text.slice(0, start) + `[${latex}]` + paragraph.text.slice(start);
    document.currentRange = makeRange(paragraph, start, `[${latex}]`, latex.length + 2);
    return true;
  };
  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("Result [a^2+b^2=c^2] end");
  const restore = makeButton();
  attachDerenderActions(makeButton(), restore);
  await restore.click();
  expect(regions.body.text).toBe("Result $a^2+b^2=c^2$ end");
});

test("renders display equations before paragraph breaks can split their source", async () => {
  regions.body.text = "$$\\int_0^1 x^2 dx=\\frac{1}{3}$$\n\\[\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  document.InsertParagraphBreak = () => {
    document.displayBreaks += 1;
    for (const bookmark of document.bookmarks.values()) {
      if (!bookmark.source.startsWith("$$") && !bookmark.source.startsWith("\\[")) continue;
      bookmark.paragraph.text = bookmark.paragraph.text.replace(
        bookmark.source,
        bookmark.source.slice(0, -2) + "\n" + bookmark.source.slice(-2),
      );
    }
  };

  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("[\\int_0^1 x^2 dx=\\frac{1}{3}]\n[\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}]");
  const restore = makeButton();
  attachDerenderActions(makeButton(), restore);
  await restore.click();
  expect(regions.body.text).toBe("$$\\int_0^1 x^2 dx=\\frac{1}{3}$$\n\\[\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]");
});

test("retries source deletion with a fresh document range", async () => {
  regions.body.text = "Hypotheses ($H_0$) and ($H_1$).";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const getBookmarkRange = document.GetBookmarkRange;
  document.GetBookmarkRange = (name) => {
    const range = getBookmarkRange(name);
    if (range) range.Delete = () => false;
    return range;
  };
  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("Hypotheses ([H_0]) and ([H_1]).");
});

test("reuses a live search result when editor positions shift", async () => {
  regions.body.text = "Hypotheses ($H_0$) and ($H_1$).";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const search = regions.body.Search.bind(regions.body);
  const calls = new Map();
  regions.body.Search = (source, ...args) => {
    const ranges = search(source, ...args);
    calls.set(source, (calls.get(source) || 0) + 1);
    if (calls.get(source) !== 2) return ranges;
    return ranges.map((range) => ({
      ...range,
      GetStartPos: () => range.GetStartPos() + 100,
    }));
  };
  const render = makeButton();
  attachRenderAction(render);
  await render.click();

  expect(regions.body.text).toBe("Hypotheses ([H_0]) and ([H_1]).");
});

test("restores source in place when EnterText inserts beside selected math", async () => {
  regions.body.text = "Before $a$ and $b$ after";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
  expect(regions.body.text).toBe("Before [a] and [b] after");

  const insert = document.EnterText;
  document.EnterText = (source) => {
    if (document.selected) {
      document.cursor = document.selected.GetStartPos();
      document.activeParagraph = document.selected.paragraph;
      document.selected = null;
    }
    return insert(source);
  };
  const restore = makeButton();
  attachDerenderActions(makeButton(), restore);
  await restore.click();

  expect(regions.body.text).toBe("Before $a$ and $b$ after");
});

test("reports the editor operation that throws during source restoration", async () => {
  regions.body.text = "Before $a$ after";
  for (const region of ["table", "header", "footer"]) regions[region].text = "No equations";
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
  const before = regions.body.text;
  const all = makeButton();
  attachDerenderActions(makeButton(), all);
  document.EnterText = () => { throw new Error("editor failure"); };
  const originalError = console.error;
  const errors = [];
  console.error = (message) => errors.push(JSON.parse(message));
  try {
    await all.click();
  } finally {
    console.error = originalError;
  }

  expect(errors).toContainEqual({
    level: "error",
    event: "derender_failed",
    scope: "all",
    stage: "enter_text",
    errorType: "Error",
  });
  expect(regions.body.text).toBe(before);
});

test("restores native equations through bookmark objects when direct range lookup fails", async () => {
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
  const getRange = document.GetBookmarkRange;
  document.GetBookmark = (name) => ({ GetRange: () => getRange(name) });
  document.GetBookmarkRange = () => { throw new Error("range lookup unavailable"); };

  const all = makeButton();
  attachDerenderActions(makeButton(), all);
  await all.click();

  expect(regions.body.text).toBe("Body $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.table.text).toBe("Table $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.header.text).toBe("Header $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
  expect(regions.footer.text).toBe("Footer $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]");
});
