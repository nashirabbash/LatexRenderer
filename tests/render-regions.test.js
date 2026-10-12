import { beforeEach, expect, mock, test } from "bun:test";

const callEditor = mock((command) => command());
mock.module("../plugin/scripts/editor.js", () => ({ callEditor }));

const { attachRenderAction } = await import("../plugin/scripts/render.js");
const { attachDerenderActions } = await import("../plugin/scripts/derender.js");

function makeParagraph(text, name) {
  return {
    text,
    name,
    GetInternalId: () => name,
    GetText() { return this.text; },
    Search(source) {
      const ranges = [];
      let start = 0;
      while ((start = this.text.indexOf(source, start)) >= 0) {
        ranges.push(makeRange(this, start, source));
        start += source.length;
      }
      return ranges;
    },
  };
}

function makeRange(paragraph, start, source, currentLength = source.length, name = null) {
  return {
    paragraph,
    source,
    name,
    currentLength,
    GetStartPos: () => start,
    GetParagraph: () => paragraph,
    GetEndPos: () => start + currentLength,
    AddBookmark(bookmarkName) {
      document.bookmarks.set(bookmarkName, { paragraph, start, source, currentLength: source.length });
      return true;
    },
    Select() { document.selected = this; },
    IntersectWith(other) { return other && other.paragraph === paragraph && other.GetStartPos() < start + currentLength && other.GetEndPos() > start; },
  };
}

function replaceRange(range, replacement) {
  const start = range.GetStartPos();
  const delta = replacement.length - range.currentLength;
  for (const bookmark of document.bookmarks.values()) {
    if (bookmark.paragraph === range.paragraph && bookmark.start > start) bookmark.start += delta;
  }
  range.paragraph.text = range.paragraph.text.slice(0, start) + replacement + range.paragraph.text.slice(start + range.currentLength);
  const bookmark = document.bookmarks.get(range.name);
  if (bookmark) bookmark.currentLength = replacement.length;
}

let document;
let regions;

function makeContent(id, paragraphs = [], tables = []) {
  return {
    GetInternalId: () => id,
    GetAllParagraphs: () => paragraphs,
    GetAllTables: () => tables,
  };
}

function makeTable(cells) {
  return {
    GetRowsCount: () => cells.length,
    GetRow(row) {
      return {
        GetCellsCount: () => cells[row].length,
        GetCell: (cell) => ({ GetContent: () => cells[row][cell] }),
      };
    },
  };
}

function setupDocument() {
  const body = makeParagraph("Body $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]", "body");
  const table = makeParagraph("Table $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]", "table");
  const header = makeParagraph("Header $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]", "header");
  const footer = makeParagraph("Footer $unfinished\n\\$5 $a$ \\(b\\) $$c$$ \\[d\\]", "footer");
  const tableContent = makeContent("cell", [table]);
  const documentContent = makeContent("body", [body], [makeTable([[tableContent]])]);
  const headerContent = makeContent("header", [header]);
  const footerContent = makeContent("footer", [footer]);
  const section = {
    GetHeader: (type) => type === "default" ? headerContent : null,
    GetFooter: (type) => type === "default" ? footerContent : null,
  };
  document = {
    bookmarks: new Map(),
    properties: new Map(),
    selected: null,
    currentRange: null,
    GetInternalId: documentContent.GetInternalId,
    displayBreaks: 0,
    GetAllParagraphs: documentContent.GetAllParagraphs,
    GetAllTables: documentContent.GetAllTables,
    GetSections: () => [section],
    GetCustomProperties() {
      return {
        Add: (name, source) => (document.properties.set(name, source), true),
        Get: (name) => document.properties.get(name),
      };
    },
    GetBookmarkRange(name) {
      const bookmark = document.bookmarks.get(name);
      if (!bookmark) return null;
      const range = makeRange(bookmark.paragraph, bookmark.start, bookmark.source, bookmark.currentLength, name);
      range.IntersectWith = (other) => other && other.paragraph === bookmark.paragraph && other.GetStartPos() < bookmark.start + bookmark.currentLength && other.GetEndPos() > bookmark.start;
      range.Select = () => { document.selected = range; document.currentRange = range; };
      return range;
    },
    GetAllBookmarksNames: () => [...document.bookmarks.keys()],
    GetRangeBySelect: () => document.currentRange,
    DeleteBookmark: (name) => document.bookmarks.delete(name),
    AddMathEquation(latex) {
      replaceRange(document.selected, `[${latex}]`);
      return true;
    },
    MoveCursorToPos() {},
    InsertParagraphBreak() { document.displayBreaks += 1; },
    EnterText(source) {
      replaceRange(document.selected, source);
      return true;
    },
  };
  regions = { body, table, header, footer };
  globalThis.Api = { GetDocument: () => document };
  globalThis.window = { Asc: { scope: {} } };
  globalThis.Asc = window.Asc;
}

function makeButton() {
  return { addEventListener(_event, callback) { this.click = callback; } };
}

beforeEach(() => {
  setupDocument();
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
    const selectedSource = document.bookmarks.get(selectedBookmark).source;
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
  const selectedSource = bookmark.source;
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
