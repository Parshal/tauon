document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;
  const root = document.documentElement;

  // =========================
  // ZOOM SYSTEM (IN-PAGE)
  // =========================
  const ZOOM_KEY = "tauon_zoom_level";
  const BASE_FONT_SIZE = 16;      // match body font-size in CSS
  const MIN_ZOOM = 0.7;
  const MAX_ZOOM = 1.8;
  const STEP = 0.1;

  let zoomLevel = 1.0;

  const zoomLabel = document.querySelector(".zoom-label");
  const zoomButtons = document.querySelectorAll(".zoom-btn");

  function clampZoom(z) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  function loadZoom() {
    const stored = localStorage.getItem(ZOOM_KEY);
    if (!stored) return;
    const parsed = parseFloat(stored);
    if (!isNaN(parsed)) {
      zoomLevel = clampZoom(parsed);
    }
  }

  function saveZoom() {
    localStorage.setItem(ZOOM_KEY, String(zoomLevel));
  }

  function applyZoom() {
    const size = (BASE_FONT_SIZE * zoomLevel).toFixed(2) + "px";
    body.style.fontSize = size;
    if (zoomLabel) {
      zoomLabel.textContent = Math.round(zoomLevel * 100) + "%";
    }
  }

  function changeZoom(delta) {
    zoomLevel = clampZoom(zoomLevel + delta);
    applyZoom();
    saveZoom();
  }

  function resetZoom() {
    zoomLevel = 1.0;
    applyZoom();
    saveZoom();
  }

  // Hook up ± buttons in header
  zoomButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.dir;
      if (dir === "+") {
        changeZoom(STEP);
      } else if (dir === "-") {
        changeZoom(-STEP);
      }
    });
  });

  // Intercept Ctrl/⌘ +, -, 0 to use our zoom
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;

    const key = e.key;

    if (key === "+" || key === "=") {
      e.preventDefault();
      changeZoom(STEP);
    } else if (key === "-" || key === "_") {
      e.preventDefault();
      changeZoom(-STEP);
    } else if (key === "0") {
      e.preventDefault();
      resetZoom();
    }
  });

  // Intercept Ctrl + wheel to zoom in-page (where supported)
  window.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    // Try to prevent browser zoom / pinch-zoom
    e.preventDefault();

    if (e.deltaY < 0) {
      // scrolling up -> zoom in
      changeZoom(STEP);
    } else if (e.deltaY > 0) {
      // scrolling down -> zoom out
      changeZoom(-STEP);
    }
  }, { passive: false });

  // Init zoom
  loadZoom();
  applyZoom();

  // =========================
  // SIDEBAR TOGGLE
  // =========================
  const btn = document.getElementById("sidebar-toggle");
  const sidebarEl = document.querySelector(".sidebar");
  let savedSidebarWidth = null;

  function updateIcon() {
    const collapsed = body.classList.contains("sidebar-collapsed");
    btn.textContent = collapsed ? "◀" : "▶";
  }

  if (btn && sidebarEl) {
    btn.addEventListener("click", function () {
      const collapsed = body.classList.contains("sidebar-collapsed");

      if (!collapsed) {
        // going to collapsed: remember current width
        const rect = sidebarEl.getBoundingClientRect();
        savedSidebarWidth = rect.width;
        body.classList.add("sidebar-collapsed");
      } else {
        // going to expanded: restore width if known
        body.classList.remove("sidebar-collapsed");
        if (savedSidebarWidth != null) {
          root.style.setProperty("--sidebar-width", savedSidebarWidth + "px");
        } else {
          root.style.removeProperty("--sidebar-width");
        }
      }

      updateIcon();
    });

    updateIcon();
  }

  // =========================
  // RESIZABLE SIDEBAR (DIVIDER DRAG)
  // =========================
  const divider = document.getElementById("divider");
  let isResizing = false;
  let startX, startWidth;

  if (divider && sidebarEl) {
    const MIN_SIDEBAR = 180;
    const MAX_SIDEBAR = 500;

    divider.addEventListener("mousedown", function (e) {
      // If collapsed, uncollapse first so dragging feels sane
      if (body.classList.contains("sidebar-collapsed")) {
        body.classList.remove("sidebar-collapsed");
        if (savedSidebarWidth != null) {
          root.style.setProperty("--sidebar-width", savedSidebarWidth + "px");
        }
        if (btn) updateIcon();
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

      savedSidebarWidth = newWidth;
      root.style.setProperty("--sidebar-width", newWidth + "px");
    });

    window.addEventListener("mouseup", function () {
      if (!isResizing) return;
      isResizing = false;
      body.classList.remove("resizing");
    });
  }
});
