(function () {
  if (window.InitTour) return;

  function globalCleanup() {
    document.querySelectorAll(".tour-tooltip").forEach(t => t.remove());
    document.querySelectorAll(".tour-overlay").forEach(o => o.remove());
    document.querySelectorAll(".tour-highlight").forEach(h => {
      h.style.outline = "";
      h.classList.remove("tour-highlight");
    });
  }

  const style = document.createElement("style");
  style.innerHTML = `
    .tour-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999998;pointer-events:none}
    .tour-tooltip{position:absolute;max-width:320px;padding:12px;border-radius:10px;background:#fff;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.18);z-index:999999;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial}
    .tour-tooltip .controls{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}
    .tour-tooltip button{padding:6px 10px;border-radius:8px;border:0;background:#f3f4f6;cursor:pointer}
    .tour-highlight{position:relative;z-index:1000000;outline:3px solid rgba(255,255,0,0.85);border-radius:6px}
    .tour-loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);z-index:9999999;}
  `;
  document.head.appendChild(style);

  function $(sel, root = document) {
    try { return root.querySelector(sel); } catch { return null; }
  }

  window.InitTour = async function (opts = {}) {
    globalCleanup();

    const tourId = opts.tour_id || document.currentScript?.getAttribute("data") || "tour_1";
    const CONVEX_URL = "https://kindhearted-cod-355.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL);

    // Loading indicator
    const loading = document.createElement("div");
    loading.className = "tour-loading";
    loading.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid"><circle cx="50" cy="50" fill="none" stroke="#000" stroke-width="10" r="35" stroke-dasharray="164.93361431346415 56.97787143782138"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1"/></circle></svg>`;
    document.body.appendChild(loading);

    let steps = [];
    try {
      steps = await client.query("steps:getByTourId", { tour_id: tourId });
    } catch (e) {
      console.error("Convex fetch error:", e);
      loading.remove();
      return;
    }

    loading.remove();
    if (!steps.length) return;

    let idx = 0, overlay = null, tooltip = null, highlighted = null;

    function createOverlay() {
      overlay = document.createElement("div");
      overlay.className = "tour-overlay";
      overlay.style.pointerEvents = "auto";
      document.body.appendChild(overlay);
    }

    function removeOverlay() { if (overlay) overlay.remove(); overlay = null; }
    function escapeHtml(s) { return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

    function positionTooltip(target, tip, preferred) {
      const pad=12,vw=window.innerWidth,vh=window.innerHeight,scrollY=window.scrollY,scrollX=window.scrollX;
      if(!target){tip.style.left=Math.round((vw-tip.offsetWidth)/2)+"px";tip.style.top=Math.round(scrollY+vh*0.12)+"px";return;}
      const r=target.getBoundingClientRect();
      const positions=preferred==="top"?["top","bottom","right","left"]:["bottom","top","right","left"];
      for(const pos of positions){
        if(pos==="bottom"){let top=r.bottom+pad+scrollY,left=Math.min(Math.max(r.left+scrollX,8),vw-tip.offsetWidth-8);if(top+tip.offsetHeight<=scrollY+vh){tip.style.top=top+"px";tip.style.left=left+"px";return;}}
        if(pos==="top"){let top=r.top-tip.offsetHeight-pad+scrollY,left=Math.min(Math.max(r.left+scrollX,8),vw-tip.offsetWidth-8);if(top>=scrollY){tip.style.top=top+"px";tip.style.left=left+"px";return;}}
        if(pos==="right"){let left=r.right+pad+scrollX,top=Math.min(Math.max(r.top+scrollY,scrollY+8),scrollY+vh-tip.offsetHeight-8);if(left+tip.offsetWidth<=scrollX+vw){tip.style.left=left+"px";tip.style.top=top+"px";return;}}
        if(pos==="left"){let left=r.left-tip.offsetWidth-pad+scrollX,top=Math.min(Math.max(r.top+scrollY,scrollY+8),scrollY+vh-tip.offsetHeight-8);if(left>=scrollX){tip.style.left=left+"px";tip.style.top=top+"px";return;}}
      }
      tip.style.left=Math.round((vw-tip.offsetWidth)/2+scrollX)+"px";
      tip.style.top=Math.round(scrollY+vh*0.12)+"px";
    }

    function cleanupTooltip() {
      if (tooltip){tooltip.removeEventListener("click", onTooltipClick); tooltip.remove(); tooltip=null;}
      if(highlighted){highlighted.style.outline=""; highlighted.classList.remove("tour-highlight"); highlighted=null;}
    }

    function updateStepData(stepId, action){
      client.mutation("steps:updateStats", { step_id: stepId, action });
    }

    function endTour() { cleanupTooltip(); removeOverlay(); window.dispatchEvent(new CustomEvent("tour-ended")); }

    function showStep(i) {
      cleanupTooltip();
      const step = steps[i];
      if(!step) return endTour();

      // increment started when step shows
      updateStepData(step.id, "started");

      const el = step.selector ? $(step.selector) : null;
      if(!el && step.selector){idx=i+1; return showStep(idx);}

      const outlineColor = step.highlight_color || "rgba(255,255,0,0.85)";
      if(el){highlighted=el; el.classList.add("tour-highlight"); el.style.outline=`3px solid ${outlineColor}`; el.scrollIntoView({behavior:"smooth",block:"center"});}

      tooltip=document.createElement("div");
      tooltip.className="tour-tooltip";
      tooltip.style.background=step.bg_color||"#fff";
      tooltip.style.color=step.text_color||"#111";
      const nextText=step.button_text && step.button_text.trim()?step.button_text:i===steps.length-1?"Finish":"Next";
      tooltip.innerHTML=`
        <div class="tour-body">
          ${step.title?`<strong>${escapeHtml(step.title)}</strong><br>`:""}
          ${escapeHtml(step.description||"")}
        </div>
        <div class="controls">
          <button data-action="back">Back</button>
          <button data-action="next">${escapeHtml(nextText)}</button>
          <button data-action="skip">Skip</button>
        </div>
      `;
      document.body.appendChild(tooltip);
      positionTooltip(el, tooltip, step.position||"bottom");
      tooltip.addEventListener("click", onTooltipClick);
    }

    function onTooltipClick(e){
      const btn=e.target.closest("button[data-action]");
      if(!btn) return;
      const a=btn.getAttribute("data-action");
      const step=steps[idx];

      if(a==="next"){updateStepData(step.id,"completed"); idx++; if(idx>=steps.length) return endTour(); showStep(idx);}
      if(a==="back"){idx=Math.max(0,idx-1); showStep(idx);}
      if(a==="skip"){updateStepData(step.id,"skipped"); return endTour();}
    }

    createOverlay();
    showStep(idx);

    return {
      next:()=>{idx++; showStep(idx);},
      back:()=>{idx=Math.max(0,idx-1); showStep(idx);},
      end:endTour,
      goTo:(n)=>{idx=Math.max(0,Math.min(n,steps.length-1)); showStep(n);}
    };
  };
})();
