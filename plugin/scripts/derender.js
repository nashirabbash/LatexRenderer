import { callEditor } from "./editor.js";
import { log, setStatus } from "./status.js";

export function attachDerenderActions(selectionButton, allButton) {
  selectionButton.addEventListener("click", () => derender(true));
  allButton.addEventListener("click", () => derender(false));
}

async function derender(selectionOnly) {
  const scope = selectionOnly ? "selection" : "all";
  setStatus(`Running: restoring ${scope}`);
  log("debug", "derender_started", { scope });
  try {
    window.Asc.scope.selectionOnly = selectionOnly;
    const result = JSON.parse(await callEditor(function () {
      let stage = "get_document";
      try {
        const doc = Api.GetDocument();
        stage = "get_custom_properties";
        const properties = doc.GetCustomProperties();
        stage = "get_bookmarks";
        const names = doc.GetAllBookmarksNames().filter((name) => name.indexOf("latexRenderer_") === 0);
        let selectedRange = null;
        if (Asc.scope.selectionOnly) {
          stage = "get_selection";
          selectedRange = doc.GetRangeBySelect();
        }
        const targets = [];
        for (let i = 0; i < names.length; i += 1) {
          stage = "get_bookmark";
          const bookmark = doc.GetBookmark(names[i]);
          stage = "bookmark_get_range";
          const range = bookmark && bookmark.GetRange();
          if (!range) continue;
          if (Asc.scope.selectionOnly) {
            if (!selectedRange) continue;
            const rangeParagraph = range.GetParagraph();
            const selectedParagraph = selectedRange.GetParagraph();
            const sameParagraph = rangeParagraph && selectedParagraph &&
              rangeParagraph.GetInternalId() === selectedParagraph.GetInternalId();
            const rangeStart = range.GetStartPos();
            const rangeEnd = range.GetEndPos();
            const selectionStart = selectedRange.GetStartPos();
            const selectionEnd = selectedRange.GetEndPos();
            const intersects = range.IntersectWith(selectedRange) ||
              (sameParagraph && rangeStart <= selectionEnd && selectionStart <= rangeEnd);
            if (!intersects) continue;
          }
          stage = "read_source";
          targets.push({ name: names[i], source: properties.Get(names[i]), position: range.GetStartPos() });
        }
        targets.sort((a, b) => b.position - a.position);
        let restored = 0;
        let failed = 0;
        for (let i = 0; i < targets.length; i += 1) {
          const target = targets[i];
          stage = "get_bookmark";
          const bookmark = doc.GetBookmark(target.name);
          stage = "bookmark_get_range";
          const range = bookmark && bookmark.GetRange();
          if (!range || typeof target.source !== "string") {
            failed += 1;
            continue;
          }
          stage = "select_equation";
          range.Select();
          stage = "enter_text";
          if (!doc.EnterText(target.source)) {
            failed += 1;
            continue;
          }
          stage = "delete_bookmark";
          doc.DeleteBookmark(target.name);
          restored += 1;
        }
        return JSON.stringify({ restored, failed });
      } catch (error) {
        return JSON.stringify({ errorStage: stage, errorType: error && error.name || "Error" });
      }
    }));
    if (result.errorStage) {
      setStatus(`Error: source restoration failed (${result.errorStage})`);
      log("error", "derender_failed", { scope, stage: result.errorStage, errorType: result.errorType });
      return;
    }
    setStatus(`Complete: ${result.restored} restored, ${result.failed} failed`);
    log(result.failed ? "error" : "success", "derender_complete", { scope, restored: result.restored, failed: result.failed });
  } catch (error) {
    setStatus("Error: source restoration failed (plugin_bridge)");
    log("error", "derender_failed", { scope, stage: "plugin_bridge", errorType: error && error.name || "Error" });
  }
}
