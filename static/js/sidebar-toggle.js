(function (win) {
  const TauonUI = (win.TauonUI = win.TauonUI || {});
  const sidebarState = (TauonUI.sidebarState = TauonUI.sidebarState || {});

  TauonUI.initSidebarToggle = function () {
    const body = document.body;
    const root = document.documentElement;
    if (!body || !root) return;

    const btn = document.getElementById("sidebar-toggle");
    const sidebarEl = document.querySelector(".sidebar");
    if (!btn || !sidebarEl) return;

    function updateIcon() {
      const collapsed = body.classList.contains("sidebar-collapsed");
      btn.textContent = collapsed ? "◀" : "▶";
    }

    TauonUI.updateSidebarToggleIcon = updateIcon;

    btn.addEventListener("click", function () {
      const collapsed = body.classList.contains("sidebar-collapsed");

      if (!collapsed) {
        const rect = sidebarEl.getBoundingClientRect();
        sidebarState.savedWidth = rect.width;
        body.classList.add("sidebar-collapsed");
      } else {
        body.classList.remove("sidebar-collapsed");
        if (sidebarState.savedWidth != null) {
          root.style.setProperty("--sidebar-width", sidebarState.savedWidth + "px");
        } else {
          root.style.removeProperty("--sidebar-width");
        }
      }

      updateIcon();
    });

    updateIcon();
  };
})(window);
