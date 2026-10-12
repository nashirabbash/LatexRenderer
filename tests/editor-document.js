let document;

function makeParagraph(text, name) {
  return {
    text,
    name,
    GetInternalId: () => name,
    GetRange(start, end) {
      return makeRange(this, start, this.text.slice(start, end));
    },
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

export function makeRange(paragraph, start, source, currentLength = source.length, name = null) {
  return {
    paragraph,
    source,
    name,
    currentLength,
    GetText() { return source; },
    GetStartPos: () => start,
    GetParagraph: (position) => position === 0 ? paragraph : null,
    GetEndPos: () => start + currentLength,
    AddBookmark(bookmarkName) {
      document.bookmarks.set(bookmarkName, { paragraph, start, source, currentLength: source.length });
      return true;
    },
    Select() { document.selected = this; },
    IntersectWith(other) { return other && other.paragraph === paragraph && other.GetStartPos() < start + currentLength && other.GetEndPos() > start; },
    Delete() {
      replaceRange(this, "");
      return true;
    },
  };
}

function replaceRange(range, replacement) {
  const start = range.GetStartPos();
  const delta = replacement.length - range.currentLength;
  for (const bookmark of document.bookmarks.values()) {
    if (bookmark.paragraph !== range.paragraph) continue;
    if (bookmark.start > start || (bookmark.start === start && range.currentLength === 0 && delta > 0)) {
      bookmark.start += delta;
    }
  }
  range.paragraph.text = range.paragraph.text.slice(0, start) + replacement + range.paragraph.text.slice(start + range.currentLength);
  const bookmark = document.bookmarks.get(range.name);
  if (bookmark) bookmark.currentLength = replacement.length;
}

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

export function setupDocument() {
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
    cursor: null,
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
    GetBookmark(name) {
      if (!document.bookmarks.has(name)) return null;
      return { GetRange: () => document.GetBookmarkRange(name) };
    },
    GetAllBookmarksNames: () => [...document.bookmarks.keys()],
    GetRangeBySelect: () => document.currentRange,
    DeleteBookmark: (name) => document.bookmarks.delete(name),
    AddMathEquation(latex) {
      const paragraph = document.activeParagraph;
      const start = document.cursor;
      replaceRange(makeRange(paragraph, start, "", 0), `[${latex}]`);
      document.currentRange = makeRange(paragraph, start, `[${latex}]`, latex.length + 2);
      return true;
    },
    MoveCursorToPos(position) {
      document.cursor = position;
      document.activeParagraph = document.selected?.paragraph || document.activeParagraph;
      document.selected = null;
    },
    InsertParagraphBreak() { document.displayBreaks += 1; },
    EnterText(source) {
      replaceRange(document.selected || makeRange(document.activeParagraph, document.cursor, "", 0), source);
      return true;
    },
  };
  const regions = { body, table, header, footer };
  globalThis.Api = { GetDocument: () => document };
  globalThis.window = { Asc: { scope: {} } };
  globalThis.Asc = window.Asc;
  return { document, regions };
}

export function makeButton() {
  return { addEventListener(_event, callback) { this.click = callback; } };
}
