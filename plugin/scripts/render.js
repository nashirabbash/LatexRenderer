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
        const bookmarkedRange = doc.GetBookmarkRange(bookmarkName);
        if (!bookmarkedRange) continue;
        bookmarkedRange.Select();
        if (!doc.AddMathEquation(equation.latex, "latex")) {
          doc.DeleteBookmark(bookmarkName);
          continue;
        }
        if (equation.display) {
          const paragraphText = paragraphs[equation.paragraph].GetText();
          const insertedRange = doc.GetBookmarkRange(bookmarkName);
          const start = insertedRange.GetStartPos();
          const end = insertedRange.GetEndPos();
          if (equation.start + equation.source.length < paragraphText.length) {
            doc.MoveCursorToPos(end);
            doc.InsertParagraphBreak();
          }
          if (equation.start > 0) {
            doc.MoveCursorToPos(start);
            doc.InsertParagraphBreak();
          }
        }
        count += 1;
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
