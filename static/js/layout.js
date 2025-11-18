document.addEventListener("DOMContentLoaded", function () {
  // Sidebar expand/collapse toggle
  var btn = document.getElementById("sidebar-toggle");
  if (btn) {
    function updateIcon() {
      var collapsed = document.body.classList.contains("sidebar-collapsed");
      btn.textContent = collapsed ? "◀" : "▶";
    }
    btn.addEventListener("click", function () {
        var collapsed = document.body.classList.contains("sidebar-collapsed");

        if (!collapsed) {
        // going to collapsed: remember current width
        if (sidebarEl) {
            var styles = window.getComputedStyle(sidebarEl);
            var w = parseInt(styles.width, 10);
            if (!isNaN(w)) savedSidebarWidth = w;
        }
        document.body.classList.add("sidebar-collapsed");
        } else {
        // going back to expanded: restore width
        document.body.classList.remove("sidebar-collapsed");
        document.documentElement.style.setProperty("--sidebar-width", savedSidebarWidth + "px");
        }
        updateIcon();
    });
    updateIcon();
  }

  // Folder expand/collapse behavior
  document.addEventListener("click", function (e) {
    var row = e.target.closest(".folder-row");
    if (!row) return;
    var container = row.closest(".folder");
    if (!container) return;
    container.classList.toggle("collapsed");
    var toggleIcon = row.querySelector(".toggle-arrow");
    if (toggleIcon) {
      toggleIcon.textContent = container.classList.contains("collapsed") ? "▶" : "▼";
    }
  });
  // Resizable sidebar via divider drag
  var divider = document.getElementById("divider");
  var isResizing = false;
  var startX, startWidth;
  var minWidth = 220;
  var maxWidth = 520;
  var savedSidebarWidth = 320;

  var sidebarEl = document.querySelector(".sidebar");

  if (divider && sidebarEl) {
    divider.addEventListener("mousedown", function (e) {
      // don't resize when collapsed
      if (document.body.classList.contains("sidebar-collapsed")) return;

      isResizing = true;
      startX = e.clientX;
      var styles = window.getComputedStyle(sidebarEl);
      startWidth = parseInt(styles.width, 10) || 320;
      document.body.classList.add("resizing");
      e.preventDefault();
    });

    window.addEventListener("mousemove", function (e) {
      if (!isResizing) return;
      var dx = e.clientX - startX;
      var newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + dx));
      savedSidebarWidth = newWidth;
      document.documentElement.style.setProperty("--sidebar-width", newWidth + "px");
    });

    window.addEventListener("mouseup", function () {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove("resizing");
    });
  }

  // Content zoom controls
  var zoomBtns = document.querySelectorAll(".zoom-btn");
  var zoomLabel = document.querySelector(".zoom-label");
  var scale = 1.0;
  var minScale = 0.8;
  var maxScale = 1.6;
  function applyScale() {
    document.documentElement.style.setProperty("--content-scale", scale.toString());
    if (zoomLabel) {
      zoomLabel.textContent = Math.round(scale * 100) + "%";
    }
  }
  zoomBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var dir = b.getAttribute("data-dir");
      if (dir === "+") {
        scale = Math.min(maxScale, scale + 0.1);
      } else if (dir === "-") {
        scale = Math.max(minScale, scale - 0.1);
      }
      applyScale();
    });
  });
  applyScale();
});

