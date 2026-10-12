// node_modules/redux/dist/redux.mjs
var $$observable = /* @__PURE__ */ (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
var symbol_observable_default = $$observable;
var randomString = () => Math.random().toString(36).substring(7).split("").join(".");
var ActionTypes = {
  INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
  REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
};
var actionTypes_default = ActionTypes;
function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null)
    return false;
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
}
function miniKindOf(val) {
  if (val === undefined)
    return "undefined";
  if (val === null)
    return "null";
  const type = typeof val;
  switch (type) {
    case "boolean":
    case "string":
    case "number":
    case "symbol":
    case "function": {
      return type;
    }
  }
  if (Array.isArray(val))
    return "array";
  if (isDate(val))
    return "date";
  if (isError(val))
    return "error";
  const constructorName = ctorName(val);
  switch (constructorName) {
    case "Symbol":
    case "Promise":
    case "WeakMap":
    case "WeakSet":
    case "Map":
    case "Set":
      return constructorName;
  }
  return Object.prototype.toString.call(val).slice(8, -1).toLowerCase().replace(/\s/g, "");
}
function ctorName(val) {
  return typeof val.constructor === "function" ? val.constructor.name : null;
}
function isError(val) {
  return val instanceof Error || typeof val.message === "string" && val.constructor && typeof val.constructor.stackTraceLimit === "number";
}
function isDate(val) {
  if (val instanceof Date)
    return true;
  return typeof val.toDateString === "function" && typeof val.getDate === "function" && typeof val.setDate === "function";
}
function kindOf(val) {
  let typeOfVal = typeof val;
  if (true) {
    typeOfVal = miniKindOf(val);
  }
  return typeOfVal;
}
function createStore(reducer, preloadedState, enhancer) {
  if (typeof reducer !== "function") {
    throw new Error(`Expected the root reducer to be a function. Instead, received: '${kindOf(reducer)}'`);
  }
  if (typeof preloadedState === "function" && typeof enhancer === "function" || typeof enhancer === "function" && typeof arguments[3] === "function") {
    throw new Error("It looks like you are passing several store enhancers to createStore(). This is not supported. Instead, compose them together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.");
  }
  if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
    enhancer = preloadedState;
    preloadedState = undefined;
  }
  if (typeof enhancer !== "undefined") {
    if (typeof enhancer !== "function") {
      throw new Error(`Expected the enhancer to be a function. Instead, received: '${kindOf(enhancer)}'`);
    }
    return enhancer(createStore)(reducer, preloadedState);
  }
  let currentReducer = reducer;
  let currentState = preloadedState;
  let currentListeners = /* @__PURE__ */ new Map;
  let nextListeners = currentListeners;
  let listenerIdCounter = 0;
  let isDispatching = false;
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = /* @__PURE__ */ new Map;
      currentListeners.forEach((listener, key) => {
        nextListeners.set(key, listener);
      });
    }
  }
  function getState() {
    if (isDispatching) {
      throw new Error("You may not call store.getState() while the reducer is executing. The reducer has already received the state as an argument. Pass it down from the top reducer instead of reading it from the store.");
    }
    return currentState;
  }
  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(`Expected the listener to be a function. Instead, received: '${kindOf(listener)}'`);
    }
    if (isDispatching) {
      throw new Error("You may not call store.subscribe() while the reducer is executing. If you would like to be notified after the store has been updated, subscribe from a component and invoke store.getState() in the callback to access the latest state. See https://redux.js.org/api/store#subscribelistener for more details.");
    }
    let isSubscribed = true;
    ensureCanMutateNextListeners();
    const listenerId = listenerIdCounter++;
    nextListeners.set(listenerId, listener);
    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }
      if (isDispatching) {
        throw new Error("You may not unsubscribe from a store listener while the reducer is executing. See https://redux.js.org/api/store#subscribelistener for more details.");
      }
      isSubscribed = false;
      ensureCanMutateNextListeners();
      nextListeners.delete(listenerId);
      currentListeners = null;
    };
  }
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(`Actions must be plain objects. Instead, the actual type was: '${kindOf(action)}'. You may need to add middleware to your store setup to handle dispatching other values, such as 'redux-thunk' to handle dispatching functions. See https://redux.js.org/tutorials/fundamentals/part-4-store#middleware and https://redux.js.org/tutorials/fundamentals/part-6-async-logic#using-the-redux-thunk-middleware for examples.`);
    }
    if (typeof action.type === "undefined") {
      throw new Error('Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
    }
    if (typeof action.type !== "string") {
      throw new Error(`Action "type" property must be a string. Instead, the actual type was: '${kindOf(action.type)}'. Value was: '${action.type}' (stringified)`);
    }
    if (isDispatching) {
      throw new Error("Reducers may not dispatch actions.");
    }
    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }
    const listeners = currentListeners = nextListeners;
    listeners.forEach((listener) => {
      listener();
    });
    return action;
  }
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== "function") {
      throw new Error(`Expected the nextReducer to be a function. Instead, received: '${kindOf(nextReducer)}`);
    }
    currentReducer = nextReducer;
    dispatch({
      type: actionTypes_default.REPLACE
    });
  }
  function observable() {
    const outerSubscribe = subscribe;
    return {
      subscribe(observer) {
        if (typeof observer !== "object" || observer === null) {
          throw new Error(`Expected the observer to be an object. Instead, received: '${kindOf(observer)}'`);
        }
        function observeState() {
          const observerAsObserver = observer;
          if (observerAsObserver.next) {
            observerAsObserver.next(getState());
          }
        }
        observeState();
        const unsubscribe = outerSubscribe(observeState);
        return {
          unsubscribe
        };
      },
      [symbol_observable_default]() {
        return this;
      }
    };
  }
  dispatch({
    type: actionTypes_default.INIT
  });
  const store = {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [symbol_observable_default]: observable
  };
  return store;
}

// plugin/scripts/plugin.js
var initialState = { status: "Idle" };
var store = createStore((state = initialState, action) => action.type === "status" ? { status: action.status } : state);
var statusElement = document.getElementById("status");
var renderButton = document.getElementById("render");
var selectionButton = document.getElementById("derender-selection");
var allButton = document.getElementById("derender-all");
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
  for (let start = 0;start < text.length; start += 1) {
    if (text[start] !== "$" || text[start - 1] === "\\" || text[start + 1] === "$")
      continue;
    for (let end = start + 1;end < text.length; end += 1) {
      if (text[end] === `
`)
        break;
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
    const paragraphs = JSON.parse(await callEditor(function() {
      const all = Api.GetDocument().GetAllParagraphs();
      const texts = [];
      for (let i = 0;i < all.length; i += 1)
        texts.push(all[i].GetText());
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
    const positioned = JSON.parse(await callEditor(function() {
      const all = Api.GetDocument().GetAllParagraphs();
      const equations = JSON.parse(Asc.scope.equations);
      const result = [];
      for (let i = 0;i < equations.length; i += 1) {
        const equation = equations[i];
        const ranges = all[equation.paragraph].Search(equation.source, true);
        let occurrence = 0;
        for (let j = 0;j < i; j += 1) {
          if (equations[j].paragraph === equation.paragraph && equations[j].source === equation.source)
            occurrence += 1;
        }
        if (ranges[occurrence])
          result.push({ ...equation, position: ranges[occurrence].GetStartPos() });
      }
      return JSON.stringify(result);
    }));
    window.Asc.scope.positioned = JSON.stringify(positioned);
    const rendered = await callEditor(function() {
      const doc = Api.GetDocument();
      const paragraphs = doc.GetAllParagraphs();
      const properties = doc.GetCustomProperties();
      const equations = JSON.parse(Asc.scope.positioned).sort((a, b) => b.position - a.position);
      let count = 0;
      for (let i = 0;i < equations.length; i += 1) {
        const equation = equations[i];
        const ranges = paragraphs[equation.paragraph].Search(equation.source, true);
        let range = null;
        for (let j = 0;j < ranges.length; j += 1) {
          if (ranges[j].GetStartPos() === equation.position)
            range = ranges[j];
        }
        if (!range)
          continue;
        const bookmarkName = "latexRenderer_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2);
        if (!range.AddBookmark(bookmarkName))
          continue;
        if (!properties.Add(bookmarkName, equation.source)) {
          doc.DeleteBookmark(bookmarkName);
          continue;
        }
        range.Select();
        if (doc.AddMathEquation(equation.source.slice(1, -1), "latex"))
          count += 1;
        else
          doc.DeleteBookmark(bookmarkName);
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
    const restored = await callEditor(function() {
      const doc = Api.GetDocument();
      const properties = doc.GetCustomProperties();
      const names = doc.GetAllBookmarksNames().filter((name) => name.indexOf("latexRenderer_") === 0);
      let selectedRange = null;
      if (Asc.scope.selectionOnly)
        selectedRange = doc.GetRangeBySelect();
      const targets = [];
      for (let i = 0;i < names.length; i += 1) {
        const range = doc.GetBookmarkRange(names[i]);
        if (!range)
          continue;
        if (selectedRange && (range.GetStartPos() !== selectedRange.GetStartPos() || range.GetEndPos() !== selectedRange.GetEndPos()))
          continue;
        if (Asc.scope.selectionOnly && !selectedRange)
          continue;
        targets.push({ name: names[i], source: properties.Get(names[i]), position: range.GetStartPos() });
      }
      targets.sort((a, b) => b.position - a.position);
      let count = 0;
      for (let i = 0;i < targets.length; i += 1) {
        const target = targets[i];
        const range = doc.GetBookmarkRange(target.name);
        if (!range || typeof target.source !== "string")
          continue;
        range.Select();
        if (!doc.EnterText(target.source))
          continue;
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
