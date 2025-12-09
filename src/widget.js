(function () {
  /** Prevent multiple InitTour definitions */
  if (window.InitTour) return;

  /** --- GLOBAL CLEANUP: clears leftover tooltips/overlays even from previous runs --- */
  function globalCleanup() {
    document.querySelectorAll(".tour-tooltip").forEach(t => t.remove());
    document.querySelectorAll(".tour-overlay").forEach(o => o.remove());
    document.querySelectorAll(".tour-highlight").forEach(h => {
      h.style.outline = "";
      h.classList.remove("tour-highlight");
    });
    const loader = document.getElementById("tour-loader");
    if (loader) loader.remove();
  }

  /** Inject base CSS */
  const style = document.createElement("style");
  style.innerHTML = `
    .tour-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999998;pointer-events:none}
    .tour-tooltip{position:absolute;max-width:320px;padding:12px;border-radius:6px;background:#fff;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.18);z-index:999999;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .tour-tooltip .controls{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}
    .tour-tooltip button{padding:6px 10px;border-radius:4px;border:0;background:#f3f4f6;cursor:pointer}
    .tour-highlight{position:relative;z-index:1000000;outline:3px solid rgba(255,255,0,0.85);border-radius:6px}
    .tour-loader {
      position: fixed;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: rgba(0,0,0,0.5);
      z-index: 10000000;
    }
    .tour-loader svg {
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg);}
      to { transform: rotate(360deg);}
    }
  `;
  document.head.appendChild(style);

  /** Safe selector */
  function $(sel, root = document) {
    try {
      return root.querySelector(sel);
    } catch {
      return null;
    }
  }

  /** Show loading modal */
  function showLoader() {
    const loader = document.createElement("div");
    loader.id = "tour-loader";
    loader.className = "tour-loader";
    loader.innerHTML = `
      <svg viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4"></circle>
      </svg>
    `;
    document.body.appendChild(loader);
  }

  /** Hide loading modal */
  function hideLoader() {
    const loader = document.getElementById("tour-loader");
    if (loader) loader.remove();
  }

  /** MAIN ENTRY POINT */
  window.InitTour = async function (opts = {}) {
    globalCleanup();
    showLoader(); // show loading immediately

    const tourId =
      opts.tour_id || document.currentScript?.getAttribute("data") || "tour_1";

    const CONVEX_URL = "https://kindhearted-cod-355.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL);

    let steps = [];
    try {
      steps = await client.query("steps:getByTourId", { tour_id: tourId });
    } catch (e) {
      console.error("Convex fetch error:", e);
      hideLoader();
      return;
    }

    hideLoader(); // hide loader once data is fetched

    if (!steps.length) return;

    let idx = 0,
      overlay = null,
      tooltip = null,
      highlighted = null;

    /** Create overlay */
    function createOverlay() {
      overlay = document.createElement("div");
      overlay.className = "tour-overlay";
      overlay.style.pointerEvents = "auto";
      document.body.appendChild(overlay);
    }

    /** Remove overlay */
    function removeOverlay() {
      if (overlay) overlay.remove();
      overlay = null;
    }

    /** Escape unsafe HTML */
    function escapeHtml(s) {
      return String(s || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c]));
    }

    /** Positioning engine */
    function positionTooltip(target, tip, preferred) {
      const pad = 12,
        vw = window.innerWidth,
        vh = window.innerHeight,
        scrollY = window.scrollY,
        scrollX = window.scrollX;

      if (!target) {
        tip.style.left = Math.round((vw - tip.offsetWidth) / 2) + "px";
        tip.style.top = Math.round(scrollY + vh * 0.12) + "px";
        return;
      }

      const r = target.getBoundingClientRect();
      const positions =
        preferred === "top"
          ? ["top", "bottom", "right", "left"]
          : ["bottom", "top", "right", "left"];

      for (const pos of positions) {
        if (pos === "bottom") {
          let top = r.bottom + pad + scrollY;
          let left = Math.min(Math.max(r.left + scrollX, 8), vw - tip.offsetWidth - 8);
          if (top + tip.offsetHeight <= scrollY + vh) {
            tip.style.top = top + "px";
            tip.style.left = left + "px";
            return;
          }
        }
        if (pos === "top") {
          let top = r.top - tip.offsetHeight - pad + scrollY;
          let left = Math.min(Math.max(r.left + scrollX, 8), vw - tip.offsetWidth - 8);
          if (top >= scrollY) {
            tip.style.top = top + "px";
            tip.style.left = left + "px";
            return;
          }
        }
        if (pos === "right") {
          let left = r.right + pad + scrollX;
          let top = Math.min(Math.max(r.top + scrollY, scrollY + 8), scrollY + vh - tip.offsetHeight - 8);
          if (left + tip.offsetWidth <= scrollX + vw) {
            tip.style.left = left + "px";
            tip.style.top = top + "px";
            return;
          }
        }
        if (pos === "left") {
          let left = r.left - tip.offsetWidth - pad + scrollX;
          let top = Math.min(Math.max(r.top + scrollY, scrollY + 8), scrollY + vh - tip.offsetHeight - 8);
          if (left >= scrollX) {
            tip.style.left = left + "px";
            tip.style.top = top + "px";
            return;
          }
        }
      }

      tip.style.left = Math.round((vw - tip.offsetWidth) / 2 + scrollX) + "px";
      tip.style.top = Math.round(scrollY + vh * 0.12) + "px";
    }

    /** Cleanup tooltip + highlight */
    function cleanupTooltip() {
      if (tooltip) {
        tooltip.removeEventListener("click", onTooltipClick);
        tooltip.remove();
        tooltip = null;
      }
      if (highlighted) {
        highlighted.style.outline = "";
        highlighted.classList.remove("tour-highlight");
        highlighted = null;
      }
    }

    /** End tour */
    function endTour() {
      cleanupTooltip();
      removeOverlay();
      window.dispatchEvent(new CustomEvent("tour-ended", {}));
    }

    /** Show step */
    function showStep(i) {
      cleanupTooltip();

      const step = steps[i];
      if (!step) return endTour();

      const el = step.selector ? $(step.selector) : null;

      if (!el && step.selector) {
        idx = i + 1;
        return showStep(idx);
      }

      const outlineColor = step.highlight_color || "rgba(255,255,0,0.85)";

      if (el) {
        highlighted = el;
        el.classList.add("tour-highlight");
        el.style.outline = `3px solid ${outlineColor}`;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      tooltip = document.createElement("div");
      tooltip.className = "tour-tooltip";

      tooltip.style.background = step.bg_color || "#fff";
      tooltip.style.color = step.text_color || "#111";

      const nextText =
        step.button_text && step.button_text.trim()
          ? step.button_text
          : i === steps.length - 1
          ? "Finish"
          : "Next";

      tooltip.innerHTML = `
        <div class="tour-body">
          ${step.title ? `<strong>${escapeHtml(step.title)}</strong><br>` : ""}
          ${escapeHtml(step.description || "")}
        </div>

        <div class="controls">
          <button data-action="back">Back</button>
          <button data-action="next">${escapeHtml(nextText)}</button>
          <button data-action="skip">Skip</button>
        </div>
      `;

      document.body.appendChild(tooltip);
      positionTooltip(el, tooltip, step.position || "bottom");

      tooltip.addEventListener("click", onTooltipClick);
    }

    /** Button actions */
    function onTooltipClick(e) {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const a = btn.getAttribute("data-action");

      if (a === "next") {
        idx++;
        if (idx >= steps.length) return endTour();
        showStep(idx);
      }

      if (a === "back") {
        idx = Math.max(0, idx - 1);
        showStep(idx);
      }

      if (a === "skip") {
        return endTour();
      }
    }

    /** INIT STARTS HERE */
    createOverlay();
    showStep(idx);

    return {
      next: () => { idx++; showStep(idx); },
      back: () => { idx = Math.max(0, idx - 1); showStep(idx); },
      end: endTour,
      goTo: (n) => { idx = Math.max(0, Math.min(n, steps.length - 1)); showStep(n); }
    };
  };
})();
