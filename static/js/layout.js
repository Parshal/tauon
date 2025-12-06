;(function (win) {
  const TauonUI = (win.TauonUI = win.TauonUI || {});

  function runInit(fnName) {
    const fn = TauonUI[fnName];
    if (typeof fn !== "function") return;
    try {
      fn();
    } catch (err) {
      console.error(`[TauonUI] Failed to init ${fnName}`, err);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    [
      "initZoomControls",
      "initSidebarToggle",
      "initSidebarResize",
      "initLogCards"
    ].forEach(runInit);
  });
})(window);
