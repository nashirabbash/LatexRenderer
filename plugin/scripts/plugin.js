import { attachDerenderActions } from "./derender.js";
import { attachRenderAction } from "./render.js";
import { initializeStatus, log, setStatus } from "./status.js";

const statusElement = document.getElementById("status");
const renderButton = document.getElementById("render");
const selectionButton = document.getElementById("derender-selection");
const allButton = document.getElementById("derender-all");

initializeStatus(statusElement, [renderButton, selectionButton, allButton]);
attachRenderAction(renderButton);
attachDerenderActions(selectionButton, allButton);

window.Asc.plugin.init = () => {
  setStatus("Idle");
  log("info", "plugin_initialized");
};
