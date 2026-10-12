import { createStore } from "redux";

const store = createStore((state = { status: "Idle" }, action) =>
  action.type === "status" ? { status: action.status } : state,
);

export function log(level, event, details = {}) {
  const write = console[level] || console.log;
  write.call(console, JSON.stringify({ level, event, ...details }));
}

export function setStatus(status) {
  store.dispatch({ type: "status", status });
  log("info", "operation_status", { status });
}

export function initializeStatus(statusElement, buttons) {
  store.subscribe(() => {
    statusElement.textContent = store.getState().status;
    const busy = store.getState().status.startsWith("Running");
    buttons.forEach((button) => { button.disabled = busy; });
  });
}
