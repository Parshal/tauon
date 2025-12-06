(function (win) {
  const TauonUI = (win.TauonUI = win.TauonUI || {});
  const sidebarState = (TauonUI.sidebarState = TauonUI.sidebarState || {});

  TauonUI.initSidebarResize = function () {
    const body = document.body;
    const root = document.documentElement;
    const divider = document.getElementById("divider");
    const sidebarEl = document.querySelector(".sidebar");

    if (!body || !root || !divider || !sidebarEl) return;

    const MIN_SIDEBAR = 180;
    const MAX_SIDEBAR = 500;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    divider.addEventListener("mousedown", function (e) {
      if (body.classList.contains("sidebar-collapsed")) {
        body.classList.remove("sidebar-collapsed");
        if (sidebarState.savedWidth != null) {
          root.style.setProperty("--sidebar-width", sidebarState.savedWidth + "px");
        }
        if (typeof TauonUI.updateSidebarToggleIcon === "function") {
          TauonUI.updateSidebarToggleIcon();
        }
      }

      isResizing = true;
      startX = e.clientX;
      startWidth = sidebarEl.getBoundingClientRect().width;
      body.classList.add("resizing");
      e.preventDefault();
    });

    window.addEventListener("mousemove", function (e) {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      let newWidth = startWidth + dx;

      if (newWidth < MIN_SIDEBAR) newWidth = MIN_SIDEBAR;
      if (newWidth > MAX_SIDEBAR) newWidth = MAX_SIDEBAR;

      sidebarState.savedWidth = newWidth;
      root.style.setProperty("--sidebar-width", newWidth + "px");
    });

    window.addEventListener("mouseup", function () {
      if (!isResizing) return;
      isResizing = false;
      body.classList.remove("resizing");
    });
  };
})(window);
