import { createStore } from "redux";

const initialState = { status: "Idle" };
const store = createStore((state = initialState, action) =>
  action.type === "status" ? { status: action.status } : state,
);
const statusElement = document.getElementById("status");
const renderButton = document.getElementById("render");
const selectionButton = document.getElementById("derender-selection");
const allButton = document.getElementById("derender-all");

function log(level, event, details = {}) {
  const write = console[level] || console.log;
  write.call(console, JSON.stringify({ level, event, ...details }));
}

function setStatus(status) {
  store.dispatch({ type: "status", status });
  log("info", "operation_status", { status });
}

store.subscribe(() => {
  statusElement.textContent = store.getState().status;
  const busy = store.getState().status.startsWith("Running");
  renderButton.disabled = busy;
  selectionButton.disabled = busy;
  allButton.disabled = busy;
});

function callEditor(command) {
  return new Promise((resolve, reject) => {
    try {
      window.Asc.plugin.callCommand(command, false, true, resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function findInlineEquations(text) {
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
        equations.push({ source: text.slice(start, end + 1), paragraph: -1 });
        start = end;
        break;
      }
    }
  }
  return equations;
}

async function renderEquations() {
  setStatus("Running: rendering equations");
  log("debug", "render_started");
  try {
    const paragraphs = JSON.parse(await callEditor(function () {
      const all = Api.GetDocument().GetAllParagraphs();
      const texts = [];
      for (let i = 0; i < all.length; i += 1) texts.push(all[i].GetText());
      return JSON.stringify(texts);
    }));
    const equations = [];
    paragraphs.forEach((text, paragraph) => {
      findInlineEquations(text).forEach((equation) => equations.push({ ...equation, paragraph }));
    });
    if (!equations.length) {
      setStatus("Complete: no inline equations found");
      log("success", "render_complete", { rendered: 0, failed: 0 });
      return;
    }

    window.Asc.scope.equations = JSON.stringify(equations);
    const positioned = JSON.parse(await callEditor(function () {
      const all = Api.GetDocument().GetAllParagraphs();
      const equations = JSON.parse(Asc.scope.equations);
      const result = [];
      for (let i = 0; i < equations.length; i += 1) {
        const equation = equations[i];
        const ranges = all[equation.paragraph].Search(equation.source, true);
        let occurrence = 0;
        for (let j = 0; j < i; j += 1) {
          if (equations[j].paragraph === equation.paragraph && equations[j].source === equation.source) occurrence += 1;
        }
        if (ranges[occurrence]) result.push({ ...equation, position: ranges[occurrence].GetStartPos() });
      }
      return JSON.stringify(result);
    }));

    window.Asc.scope.positioned = JSON.stringify(positioned);
    const rendered = await callEditor(function () {
      const doc = Api.GetDocument();
      const paragraphs = doc.GetAllParagraphs();
      const properties = doc.GetCustomProperties();
      const equations = JSON.parse(Asc.scope.positioned).sort((a, b) => b.position - a.position);
      let count = 0;
      for (let i = 0; i < equations.length; i += 1) {
        const equation = equations[i];
        const ranges = paragraphs[equation.paragraph].Search(equation.source, true);
        let range = null;
        for (let j = 0; j < ranges.length; j += 1) {
          if (ranges[j].GetStartPos() === equation.position) range = ranges[j];
        }
        if (!range) continue;
        const bookmarkName = "latexRenderer_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2);
        if (!range.AddBookmark(bookmarkName)) continue;
        if (!properties.Add(bookmarkName, equation.source)) {
          doc.DeleteBookmark(bookmarkName);
          continue;
        }
        range.Select();
        if (doc.AddMathEquation(equation.source.slice(1, -1), "latex")) count += 1;
        else doc.DeleteBookmark(bookmarkName);
      }
      return count;
    });
    const renderedCount = Number(rendered) || 0;
    const failed = equations.length - renderedCount;
    setStatus(`Complete: ${renderedCount} rendered, ${failed} failed`);
    log(failed ? "error" : "success", "render_complete", { rendered: renderedCount, failed });
  } catch (error) {
    setStatus("Error: rendering failed");
    log("error", "render_failed", { errorType: error && error.name || "Error" });
  }
}

async function derender(selectionOnly) {
  const scope = selectionOnly ? "selection" : "all";
  setStatus(`Running: restoring ${scope}`);
  log("debug", "derender_started", { scope });
  try {
    window.Asc.scope.selectionOnly = selectionOnly;
    const restored = await callEditor(function () {
      const doc = Api.GetDocument();
      const properties = doc.GetCustomProperties();
      const names = doc.GetAllBookmarksNames().filter((name) => name.indexOf("latexRenderer_") === 0);
      let selectedRange = null;
      if (Asc.scope.selectionOnly) selectedRange = doc.GetRangeBySelect();
      const targets = [];
      for (let i = 0; i < names.length; i += 1) {
        const range = doc.GetBookmarkRange(names[i]);
        if (!range) continue;
        if (selectedRange && (range.GetStartPos() !== selectedRange.GetStartPos() || range.GetEndPos() !== selectedRange.GetEndPos())) continue;
        if (Asc.scope.selectionOnly && !selectedRange) continue;
        targets.push({ name: names[i], source: properties.Get(names[i]), position: range.GetStartPos() });
      }
      targets.sort((a, b) => b.position - a.position);
      let count = 0;
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        const range = doc.GetBookmarkRange(target.name);
        if (!range || typeof target.source !== "string") continue;
        range.Select();
        if (!doc.EnterText(target.source)) continue;
        doc.DeleteBookmark(target.name);
        count += 1;
      }
      return count;
    });
    const count = Number(restored) || 0;
    setStatus(`Complete: ${count} equations restored`);
    log("success", "derender_complete", { scope, restored: count });
  } catch (error) {
    setStatus("Error: source restoration failed");
    log("error", "derender_failed", { scope, errorType: error && error.name || "Error" });
  }
}

renderButton.addEventListener("click", renderEquations);
selectionButton.addEventListener("click", () => derender(true));
allButton.addEventListener("click", () => derender(false));
window.Asc.plugin.init = () => {
  setStatus("Idle");
  log("info", "plugin_initialized");
};
