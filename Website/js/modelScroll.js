(function enablePageScrollOverModels() {
  function attachScrollPassthrough(viewer) {
    if (viewer.dataset.scrollSafe === "true") {
      return;
    }

    viewer.dataset.scrollSafe = "true";
    viewer.setAttribute("touch-action", "pan-y");
    viewer.setAttribute("disable-zoom", "");
    viewer.setAttribute("interaction-prompt", "none");

    // Wheel/trackpad should always move the page, never orbit or zoom the model.
    viewer.addEventListener(
      "wheel",
      function (event) {
        event.stopImmediatePropagation();
        if (event.cancelable) {
          event.preventDefault();
        }
        const scroller = document.scrollingElement || document.documentElement;
        scroller.scrollTop += event.deltaY;
        scroller.scrollLeft += event.deltaX;
      },
      { capture: true, passive: false }
    );
  }

  function init() {
    document.querySelectorAll("model-viewer").forEach(attachScrollPassthrough);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const observer = new MutationObserver(init);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
