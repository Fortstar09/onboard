(function () {
  // Prevents re-initialization if InitTour already exists
  if (window.InitTour) return;

  // Add basic CSS for overlay, tooltip, highlighted elements
  const style = document.createElement("style");
  style.innerHTML = `
    .tour-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999998;pointer-events:none}
    .tour-tooltip{position:absolute;max-width:320px;padding:12px;border-radius:10px;background:#fff;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.18);z-index:999999;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .tour-tooltip .controls{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}
    .tour-tooltip button{padding:6px 10px;border-radius:8px;border:0;background:#f3f4f6;cursor:pointer}
    .tour-highlight{position:relative;z-index:1000000;box-shadow:0 0 0 4px rgba(255,255,255,0.0) !important;outline:3px solid rgba(255,255,0,0.85);border-radius:6px}
    @media (max-width:420px){ .tour-tooltip{max-width:92vw;padding:10px} }
  `;
  document.head.appendChild(style);

  // Helper function to safely select an element
  function $(sel, root = document) {
    try {
      return root.querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  // Main InitTour function
  window.InitTour = async function (opts = {}) {
    // Get tour ID from data attribute or fallback
    const tourId =
      opts.tour_id || document.currentScript?.getAttribute("data") || "tour_1";
    if (!tourId) return;

    // Convex client setup
    const CONVEX_URL = "https://kindhearted-cod-355.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL);

    // Fetch steps from Convex database for this tour
    let steps = [];
    try {
      steps = await client.query("steps:getByTourId", { tour_id: tourId });
      console.log("Steps fetched from Convex:", steps);
    } catch (e) {
      console.error("Error fetching steps:", e);
      return;
    }

    if (!steps.length) return;

    let idx = 0,
      overlay = null,
      tooltip = null,
      highlighted = null;

    /**
     * Create the semi-transparent overlay behind the tooltip
     */
    function createOverlay() {
      overlay = document.createElement("div");
      overlay.className = "tour-overlay";
      overlay.style.pointerEvents = "auto";
      document.body.appendChild(overlay);
    }

    /** Remove overlay from DOM */
    function removeOverlay() {
      if (overlay) overlay.remove();
      overlay = null;
    }

    /**
     * Escape HTML to prevent XSS in tooltips
     */
    function escapeHtml(s) {
      return String(s || "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[c])
      );
    }

    /**
     * Position tooltip near the target element
     * @param {HTMLElement} target - element to highlight
     * @param {HTMLElement} tip - tooltip element
     * @param {string} preferred - preferred position: top/bottom/left/right
     */
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
          let left = Math.min(
            Math.max(r.left + scrollX, 8),
            vw - tip.offsetWidth - 8
          );
          if (top + tip.offsetHeight <= scrollY + vh) {
            tip.style.top = top + "px";
            tip.style.left = left + "px";
            return;
          }
        }
        if (pos === "top") {
          let top = r.top - tip.offsetHeight - pad + scrollY;
          let left = Math.min(
            Math.max(r.left + scrollX, 8),
            vw - tip.offsetWidth - 8
          );
          if (top >= scrollY) {
            tip.style.top = top + "px";
            tip.style.left = left + "px";
            return;
          }
        }
        if (pos === "right") {
          let left = r.right + pad + scrollX;
          let top = Math.min(
            Math.max(r.top + scrollY, scrollY + 8),
            scrollY + vh - tip.offsetHeight - 8
          );
          if (left + tip.offsetWidth <= scrollX + vw) {
            tip.style.left = left + "px";
            tip.style.top = top + "px";
            return;
          }
        }
        if (pos === "left") {
          let left = r.left - tip.offsetWidth - pad + scrollX;
          let top = Math.min(
            Math.max(r.top + scrollY, scrollY + 8),
            scrollY + vh - tip.offsetHeight - 8
          );
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

    /** Cleanup tooltip and highlighted element */
    function cleanupTooltip() {
      if (tooltip) {
        tooltip.removeEventListener("click", onTooltipClick);
        tooltip.remove();
        tooltip = null;
      }
      if (highlighted) {
        highlighted.classList.remove("tour-highlight");
        highlighted = null;
      }
    }

    /** Ends the tour completely */
    function endTour() {
      cleanupTooltip();
      removeOverlay();
      window.dispatchEvent(new CustomEvent("tour-ended", {}));
    }

    /** Show the current step */
    function showStep(i) {
      cleanupTooltip();
      const step = steps[i];
      if (!step) {
        endTour();
        return;
      }

      const el = step.selector ? $(step.selector) : null;
      if (!el && step.selector) {
        idx = i + 1;
        showStep(idx);
        return;
      }

      if (highlighted) highlighted.classList.remove("tour-highlight");
      if (el) {
        highlighted = el;
        el.classList.add("tour-highlight");
      }

      if (el)
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });

      tooltip = document.createElement("div");
      tooltip.className = "tour-tooltip";
      tooltip.style.background = step.bg_color || "#fff";
      tooltip.style.color = step.text_color || "#111";

      tooltip.innerHTML = `
        <div class="tour-body">
          ${
            step.title
              ? `<strong>${escapeHtml(
                  step.title
                )}</strong><div style="height:6px"></div>`
              : ""
          }
          ${escapeHtml(step.description || "")}
        </div>
        <div class="controls">
          <button data-action="back">Back</button>
          <button data-action="next">${
            step.button_text || (i === steps.length - 1 ? "Finish" : "Next")
          }</button>
          <button data-action="skip">Skip</button>
        </div>
      `;
      document.body.appendChild(tooltip);

      positionTooltip(el, tooltip, step.position || "bottom");

      tooltip.addEventListener("click", onTooltipClick);
      window.dispatchEvent(
        new CustomEvent("tour-step", { detail: { stepIndex: i, step } })
      );
    }

    /** Handle click actions in the tooltip */
    function onTooltipClick(e) {
      const a = e.target.closest("button[data-action]");
      if (!a) return;
      const act = a.getAttribute("data-action");

      // Log current step data and action for debugging
      console.log({ stepIndex: idx, action: act, step: steps[idx] });

      if (act === "next") {
        idx++;
        if (idx >= steps.length) endTour();
        else showStep(idx);
      }
      if (act === "back") {
        idx = Math.max(0, idx - 1);
        showStep(idx);
      }
      if (act === "skip") endTour();
    }

    // Initialize tour
    createOverlay();
    showStep(idx);

    // Return API to control tour externally
    return {
      next: () => {
        idx++;
        showStep(idx);
      },
      back: () => {
        idx = Math.max(0, idx - 1);
        showStep(idx);
      },
      end: endTour,
      goTo: (n) => {
        idx = Math.max(0, Math.min(n, steps.length - 1));
        showStep(n);
      },
    };
  };
})();
