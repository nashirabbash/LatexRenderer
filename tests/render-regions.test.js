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

test("reports the editor operation that throws during source restoration", async () => {
  const render = makeButton();
  attachRenderAction(render);
  await render.click();
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
