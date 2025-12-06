(function (win) {
  const TauonUI = (win.TauonUI = win.TauonUI || {});

  TauonUI.initZoomControls = function () {
    const body = document.body;
    if (!body) return;

    const ZOOM_KEY = "tauon_zoom_level";
    const BASE_FONT_SIZE = 16;
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

    window.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        if (e.deltaY < 0) {
          changeZoom(STEP);
        } else if (e.deltaY > 0) {
          changeZoom(-STEP);
        }
      },
      { passive: false }
    );

    loadZoom();
    applyZoom();
  };
})(window);
