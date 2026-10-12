import { afterEach, describe, expect, test } from "bun:test";
import { attachRenderAction } from "../plugin/scripts/render.js";
import { initializeStatus } from "../plugin/scripts/status.js";

const originalWindow = globalThis.window;
const originalApi = globalThis.Api;
const originalAsc = globalThis.Asc;
const originalConsole = { ...console };

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.Api = originalApi;
  globalThis.Asc = originalAsc;
  Object.assign(console, originalConsole);
});

describe("document equation rendering", () => {
  test("renders body, table, header, and footer while skipping failures and protecting source", async () => {
    const texts = {
      body: "$unsupported_secret$",
      table: "$table$",
      header: "$header$",
      footer: "$footer$",
    };
    const bookmarkRanges = new Map();
    function makeParagraph(text) {
      return {
        GetText: () => text,
        Search: (source) => {
          const ranges = [];
          const start = text.indexOf(source);
          if (start >= 0) {
            const position = start;
            const range = {
              GetStartPos: () => position,
              AddBookmark: (name) => { bookmarkRanges.set(name, range); return true; },
              Select: () => {},
            };
            ranges.push(range);
          }
          return ranges;
        },
      };
    }
    function makeContent(id, paragraph) {
      return {
        GetInternalId: () => id,
        GetAllParagraphs: () => [paragraph],
        GetAllTables: () => [],
      };
    }
    const paragraphs = Object.fromEntries(Object.entries(texts).map(([name, text]) => [name, makeParagraph(text)]));
    const tableContent = makeContent("table", paragraphs.table);
    const tableCell = { GetContent: () => tableContent };
    const tableRow = { GetCellsCount: () => 1, GetCell: () => tableCell };
    const table = { GetRowsCount: () => 1, GetRow: () => tableRow };
    const header = makeContent("header", paragraphs.header);
    const footer = makeContent("footer", paragraphs.footer);
    const document = {
      GetInternalId: () => "document",
      GetAllParagraphs: () => [paragraphs.body],
      GetAllTables: () => [table],
      GetSections: () => [{ GetHeader: () => header, GetFooter: () => footer }],
      GetCustomProperties: () => ({ Add: () => true }),
      GetBookmarkRange: (name) => bookmarkRanges.get(name),
      AddMathEquation: (latex) => {
        if (latex === "unsupported_secret") throw new SyntaxError("invalid $unsupported_secret$");
        return true;
      },
      DeleteBookmark: (name) => bookmarkRanges.delete(name),
    };
    const logs = [];
    for (const level of ["debug", "info", "error", "log"]) {
      console[level] = (entry) => logs.push(String(entry));
    }
    globalThis.window = {
      Asc: {
        scope: {},
        plugin: {
          callCommand: (command, _close, _async, callback) => callback(command()),
        },
      },
    };
    globalThis.Api = { GetDocument: () => document };
    globalThis.Asc = { scope: window.Asc.scope };
    const statusElement = { textContent: "" };
    const button = { addEventListener: (_event, handler) => { button.click = handler; }, disabled: false };
    initializeStatus(statusElement, [button]);
    attachRenderAction(button);

    await button.click();

    expect(statusElement.textContent).toContain("3 rendered, 1 failed");
    for (const [name, paragraph] of Object.entries(paragraphs)) {
      expect(paragraph.GetText()).toBe(texts[name]);
    }
    expect(logs.join("\n")).not.toContain("unsupported_secret");
    expect(logs.some((entry) => entry.includes('"event":"render_complete"'))).toBe(true);
    expect(logs.some((entry) => entry.includes('"exception":1'))).toBe(true);
  });
});
