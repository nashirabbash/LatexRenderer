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
        if (Asc.scope.selectionOnly && (!selectedRange || !range.IntersectWith(selectedRange))) continue;
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
