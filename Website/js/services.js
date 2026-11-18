(function initServicesStage() {
  const stage = document.querySelector(".services-stage");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!stage) {
    return;
  }

  function reveal() {
    if (reduceMotion.matches) {
      stage.classList.add("is-title-in");
      stage.classList.add("is-typed");
      return;
    }

    window.requestAnimationFrame(function () {
      stage.classList.add("is-title-in");
    });
    window.setTimeout(function () {
      stage.classList.add("is-typed");
    }, 620);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal);
  } else {
    reveal();
  }

  document.querySelectorAll(".services-actions a[href^='#']").forEach(function (link) {
    link.addEventListener("click", function (event) {
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      if (history.replaceState) {
        history.replaceState(null, "", "#" + id);
      }
    });
  });
})();
