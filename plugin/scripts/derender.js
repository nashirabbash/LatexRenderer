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
      const doc = Api.GetDocument();
      const properties = doc.GetCustomProperties();
      const names = doc.GetAllBookmarksNames().filter((name) => name.indexOf("latexRenderer_") === 0);
      let selectedRange = null;
      if (Asc.scope.selectionOnly) selectedRange = doc.GetRangeBySelect();
      const targets = [];
      for (let i = 0; i < names.length; i += 1) {
        const range = doc.GetBookmarkRange(names[i]);
        if (!range) continue;
        if (Asc.scope.selectionOnly) {
          if (!selectedRange) continue;
          const start = selectedRange.GetStartPos();
          const end = selectedRange.GetEndPos();
          const intersects = range.IntersectWith(selectedRange) || (start === end && start >= range.GetStartPos() && start <= range.GetEndPos());
          if (!intersects) continue;
        }
        targets.push({ name: names[i], source: properties.Get(names[i]), position: range.GetStartPos() });
      }
      targets.sort((a, b) => b.position - a.position);
      let restored = 0;
      let failed = 0;
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        const range = doc.GetBookmarkRange(target.name);
        if (!range || typeof target.source !== "string") {
          failed += 1;
          continue;
        }
        range.Select();
        if (!doc.EnterText(target.source)) {
          failed += 1;
          continue;
        }
        doc.DeleteBookmark(target.name);
        restored += 1;
      }
      return JSON.stringify({ restored, failed });
    }));
    setStatus(`Complete: ${result.restored} restored, ${result.failed} failed`);
    log(result.failed ? "error" : "success", "derender_complete", { scope, restored: result.restored, failed: result.failed });
  } catch (error) {
    setStatus("Error: source restoration failed");
    log("error", "derender_failed", { scope, errorType: error && error.name || "Error" });
  }
}
