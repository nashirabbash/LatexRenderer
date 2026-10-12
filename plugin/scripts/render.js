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
    const texts = JSON.parse(await callEditor(function () {
      function addContent(content, paragraphs, seen) {
        if (!content) return;
        const id = content.GetInternalId();
        if (seen[id]) return;
        seen[id] = true;
        const ownParagraphs = content.GetAllParagraphs();
        for (let i = 0; i < ownParagraphs.length; i += 1) paragraphs.push(ownParagraphs[i]);
        const tables = content.GetAllTables();
        for (let i = 0; i < tables.length; i += 1) {
          const table = tables[i];
          for (let row = 0; row < table.GetRowsCount(); row += 1) {
            const tableRow = table.GetRow(row);
            for (let cell = 0; cell < tableRow.GetCellsCount(); cell += 1) {
              addContent(tableRow.GetCell(cell).GetContent(), paragraphs, seen);
            }
          }
        }
      }
      const doc = Api.GetDocument();
      const paragraphs = [];
      const seen = {};
      addContent(doc, paragraphs, seen);
      const sections = doc.GetSections();
      const types = ["default", "first", "even"];
      for (let i = 0; i < sections.length; i += 1) {
        for (let j = 0; j < types.length; j += 1) {
          addContent(sections[i].GetHeader(types[j], false), paragraphs, seen);
          addContent(sections[i].GetFooter(types[j], false), paragraphs, seen);
        }
      }
      const texts = [];
      for (let i = 0; i < paragraphs.length; i += 1) texts.push(paragraphs[i].GetText());
      return JSON.stringify(texts);
    }));
    const equations = [];
    let display = 0;
    texts.forEach((text, paragraph) => {
      findMarkedEquations(text).forEach((equation) => {
        if (equation.display) display += 1;
        equations.push({ ...equation, paragraph });
      });
    });
    if (!equations.length) {
      setStatus("Complete: no marked equations found");
      log("success", "render_complete", { rendered: 0, failed: 0 });
      return;
    }

    window.Asc.scope.equations = JSON.stringify(equations);
    const rendered = await callEditor(function () {
      function addContent(content, paragraphs, seen) {
        if (!content) return;
        const id = content.GetInternalId();
        if (seen[id]) return;
        seen[id] = true;
        const ownParagraphs = content.GetAllParagraphs();
        for (let i = 0; i < ownParagraphs.length; i += 1) paragraphs.push(ownParagraphs[i]);
        const tables = content.GetAllTables();
        for (let i = 0; i < tables.length; i += 1) {
          const table = tables[i];
          for (let row = 0; row < table.GetRowsCount(); row += 1) {
            const tableRow = table.GetRow(row);
            for (let cell = 0; cell < tableRow.GetCellsCount(); cell += 1) {
              addContent(tableRow.GetCell(cell).GetContent(), paragraphs, seen);
            }
          }
        }
      }
      function getParagraphs() {
        const paragraphs = [];
        const seen = {};
        addContent(doc, paragraphs, seen);
        const sections = doc.GetSections();
        const types = ["default", "first", "even"];
        for (let i = 0; i < sections.length; i += 1) {
          for (let j = 0; j < types.length; j += 1) {
            addContent(sections[i].GetHeader(types[j], false), paragraphs, seen);
            addContent(sections[i].GetFooter(types[j], false), paragraphs, seen);
          }
        }
        return paragraphs;
      }
      const doc = Api.GetDocument();
      let paragraphs = getParagraphs();
      const equations = JSON.parse(Asc.scope.equations);
      const positioned = [];
      let unpositioned = 0;
      for (let i = 0; i < equations.length; i += 1) {
        const equation = equations[i];
        try {
          const ranges = paragraphs[equation.paragraph].Search(equation.source, true);
          let occurrence = 0;
          for (let j = 0; j < i; j += 1) {
            if (equations[j].paragraph === equation.paragraph && equations[j].source === equation.source) occurrence += 1;
          }
          if (ranges[occurrence]) positioned.push({ ...equation, position: ranges[occurrence].GetStartPos() });
          else unpositioned += 1;
        } catch (_error) {
          unpositioned += 1;
        }
      }
      positioned.sort((a, b) => b.paragraph - a.paragraph || b.position - a.position);
      const properties = doc.GetCustomProperties();
      const failures = { range: 0, bookmark: 0, property: 0, bookmarkRange: 0, equation: 0, exception: 0 };
      const removeBookmark = (name) => {
        try {
          doc.DeleteBookmark(name);
        } catch (_error) {
        }
      };
      let count = 0;
      for (let i = 0; i < positioned.length; i += 1) {
        const equation = positioned[i];
        let sourceDeleted = false;
        let sourcePosition;
        let bookmarkName;
        try {
          paragraphs = getParagraphs();
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
          const start = bookmarkedRange.GetStartPos();
          sourcePosition = start;
          if (!bookmarkedRange.Delete()) {
            failures.range += 1;
            continue;
          }
          sourceDeleted = true;
          removeBookmark(bookmarkName);
          doc.MoveCursorToPos(start);
          if (!doc.AddMathEquation(equation.latex, "latex")) {
            doc.MoveCursorToPos(start);
            doc.EnterText(equation.source);
            sourceDeleted = false;
            failures.equation += 1;
            continue;
          }
          sourceDeleted = false;
          const renderedRange = doc.GetRangeBySelect();
          if (!renderedRange || !renderedRange.AddBookmark(bookmarkName)) {
            failures.bookmarkRange += 1;
            continue;
          }
          count += 1;
        } catch (_error) {
          if (sourceDeleted) {
            doc.MoveCursorToPos(sourcePosition);
            doc.EnterText(equation.source);
          }
          if (bookmarkName) removeBookmark(bookmarkName);
          failures.exception += 1;
        }
      }
      return JSON.stringify({ count, unpositioned, failures });
    });
    const result = JSON.parse(rendered);
    const renderedCount = Number(result.count) || 0;
    const failed = equations.length - renderedCount;
    setStatus(`Complete: ${renderedCount} rendered, ${failed} failed (position ${result.unpositioned}, range ${result.failures.range}, bookmark ${result.failures.bookmark}, property ${result.failures.property}, editor ${result.failures.equation}, exception ${result.failures.exception})`);
    if (display) log("debug", "display_equations_found", { count: display });
    log(failed ? "error" : "success", "render_complete", {
      rendered: renderedCount,
      failed,
      unpositioned: result.unpositioned,
      ...result.failures,
    });
  } catch (error) {
    setStatus("Error: rendering failed");
    log("error", "render_failed", { errorType: error && error.name || "Error" });
  }
}
