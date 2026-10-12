import { callEditor } from "./editor.js";
import { findMarkedEquations } from "./equations.js";
import { log, setStatus } from "./status.js";

export function attachRenderAction(button) {
  button.addEventListener("click", renderEquations);
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
      findMarkedEquations(text).forEach((equation) => equations.push({ ...equation, paragraph }));
    });
    if (!equations.length) {
      setStatus("Complete: no marked equations found");
      log("success", "render_complete", { rendered: 0, failed: 0 });
      return;
    }
    equations.forEach((equation) => {
      if (equation.display) log("debug", "display_equation_separation", { paragraph: equation.paragraph, start: equation.start });
    });

    window.Asc.scope.equations = JSON.stringify(equations);
    const positioned = JSON.parse(await callEditor(function () {
      const all = Api.GetDocument().GetAllParagraphs();
      const equations = JSON.parse(Asc.scope.equations);
      const result = [];
      for (let i = 0; i < equations.length; i += 1) {
        const equation = equations[i];
        try {
          const ranges = all[equation.paragraph].Search(equation.source, true);
          let occurrence = 0;
          for (let j = 0; j < i; j += 1) {
            if (equations[j].paragraph === equation.paragraph && equations[j].source === equation.source) occurrence += 1;
          }
          if (ranges[occurrence]) result.push({ ...equation, position: ranges[occurrence].GetStartPos() });
        } catch (_error) {
        }
      }
      return JSON.stringify(result);
    }));
    window.Asc.scope.positioned = JSON.stringify(positioned);
    const unpositioned = equations.length - positioned.length;
    const rendered = await callEditor(function () {
      const doc = Api.GetDocument();
      const properties = doc.GetCustomProperties();
      const equations = JSON.parse(Asc.scope.positioned).sort((a, b) => b.position - a.position);
      const removeBookmark = (name) => {
        try {
          doc.DeleteBookmark(name);
        } catch (_error) {
        }
      };
      const failures = { range: 0, bookmark: 0, property: 0, bookmarkRange: 0, equation: 0, exception: 0 };
      let count = 0;
      for (let i = 0; i < equations.length; i += 1) {
        const equation = equations[i];
        let bookmarkName;
        try {
          const paragraphs = doc.GetAllParagraphs();
          const ranges = paragraphs[equation.paragraph].Search(equation.source, true);
          let range = null;
          for (let j = 0; j < ranges.length; j += 1) {
            if (ranges[j].GetStartPos() === equation.position) range = ranges[j];
          }
          if (!range) {
            failures.range += 1;
            continue;
          }
          bookmarkName = "latexRenderer_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2);
          if (!range.AddBookmark(bookmarkName)) {
            failures.bookmark += 1;
            continue;
          }
          if (!properties.Add(bookmarkName, equation.source)) {
            removeBookmark(bookmarkName);
            failures.property += 1;
            continue;
          }
          let bookmarkedRange = doc.GetBookmarkRange(bookmarkName);
          if (!bookmarkedRange) {
            failures.bookmarkRange += 1;
            continue;
          }
          if (equation.display) {
            const paragraphText = paragraphs[equation.paragraph].GetText();
            const start = bookmarkedRange.GetStartPos();
            if (equation.start + equation.source.length < paragraphText.length) {
              doc.MoveCursorToPos(start + equation.source.length);
              doc.InsertParagraphBreak();
            }
            if (equation.start > 0) {
              doc.MoveCursorToPos(start);
              doc.InsertParagraphBreak();
            }
          }
          bookmarkedRange = doc.GetBookmarkRange(bookmarkName);
          if (!bookmarkedRange) {
            failures.bookmarkRange += 1;
            continue;
          }
          bookmarkedRange.Select();
          if (!doc.AddMathEquation(equation.latex, "latex")) {
            removeBookmark(bookmarkName);
            failures.equation += 1;
            continue;
          }
          count += 1;
        } catch (_error) {
          if (bookmarkName) removeBookmark(bookmarkName);
          failures.exception += 1;
        }
      }
      return JSON.stringify({ count, failures });
    });
    const result = JSON.parse(rendered);
    const renderedCount = Number(result.count) || 0;
    const failed = equations.length - renderedCount;
    setStatus(`Complete: ${renderedCount} rendered, ${failed} failed (position ${unpositioned}, range ${result.failures.range}, bookmark ${result.failures.bookmark}, property ${result.failures.property}, editor ${result.failures.equation}, exception ${result.failures.exception})`);
    log(failed ? "error" : "success", "render_complete", {
      rendered: renderedCount,
      failed,
      unpositioned,
      ...result.failures,
    });
  } catch (error) {
    setStatus("Error: rendering failed");
    log("error", "render_failed", { errorType: error && error.name || "Error" });
  }
}
