(function (win) {
  const TauonUI = (win.TauonUI = win.TauonUI || {});

  TauonUI.initLogCards = function () {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;

    const headings = Array.from(mainEl.querySelectorAll("h3"));
    if (!headings.length) return;

    headings.forEach((h3) => {
      const raw = (h3.textContent || "").trim();
      if (!raw.toLowerCase().startsWith("[log]")) return;

      const cleaned = raw.replace(/^\s*\[log\]\s*/i, "");
      h3.textContent = cleaned;

      const wrapper = document.createElement("section");
      wrapper.className = "log-entry";

      const parent = h3.parentNode;
      if (!parent) return;
      parent.insertBefore(wrapper, h3);
      wrapper.appendChild(h3);

      let node = wrapper.nextSibling;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent.trim()) {
            wrapper.appendChild(node);
            node = wrapper.nextSibling;
            continue;
          }
          break;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          if (/^H[1-6]$/i.test(node.tagName)) {
            const rawHeading = (node.textContent || "").trim();
            const isStats =
              node.tagName.toUpperCase() === "H4" && /^\s*\[stats\]/i.test(rawHeading);
            if (!isStats) {
              break;
            }
          }

          wrapper.appendChild(node);
          node = wrapper.nextSibling;
          continue;
        }

        break;
      }
    });

    const cards = Array.from(mainEl.querySelectorAll(".log-entry"));
    cards.forEach((card) => {
      const statsHeads = Array.from(card.querySelectorAll("h4"));

      statsHeads.forEach((h4) => {
        const raw = (h4.textContent || "").trim();
        if (!raw.toLowerCase().startsWith("[stats]")) return;

        const cleaned = raw.replace(/^\s*\[stats\]\s*/i, "");
        h4.textContent = cleaned;
        h4.classList.add("log-stats");

        let node = h4.nextSibling;
        let hasContentAfter = false;

        while (node) {
          if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
            node = node.nextSibling;
            continue;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            hasContentAfter = true;
            break;
          }
          node = node.nextSibling;
        }

        if (!hasContentAfter) {
          h4.classList.add("log-stats-last");
        }
      });
    });
  };
})(window);
