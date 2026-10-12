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
  test("skips an unsupported equation, renders later equations, and keeps source out of logs", async () => {
    const text = "$unsupported_secret$ then $x+1$";
    const bookmarkRanges = new Map();
    const paragraph = {
      GetText: () => text,
      Search: (source) => {
        const ranges = [];
        let start = text.indexOf(source);
        while (start >= 0) {
          const position = start;
          const range = {
            GetStartPos: () => position,
            AddBookmark: (name) => { bookmarkRanges.set(name, range); return true; },
            Select: () => {},
          };
          ranges.push(range);
          start = text.indexOf(source, start + source.length);
        }
        return ranges;
      },
    };
    const document = {
      GetAllParagraphs: () => [paragraph],
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

    expect(statusElement.textContent).toContain("1 rendered, 1 failed");
    expect(paragraph.GetText()).toBe(text);
    expect(logs.join("\n")).not.toContain("unsupported_secret");
    expect(logs.some((entry) => entry.includes('"event":"render_complete"'))).toBe(true);
    expect(logs.some((entry) => entry.includes('"exception":1'))).toBe(true);
  });
});
