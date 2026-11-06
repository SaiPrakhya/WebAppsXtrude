(function initOurWorkHeader() {
  const header = document.querySelector(".our-work-header");
  if (!header) {
    return;
  }

  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 50);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

(function initOurWorkPieces() {
  function initSlider(root) {
    const track = root.querySelector(".work-piece-slider-track");
    const viewport = root.querySelector(".work-piece-slider-viewport");
    const slides = Array.from(root.querySelectorAll(".work-piece-slide"));
    const prevBtn = root.querySelector(".work-piece-slider-btn.is-prev");
    const nextBtn = root.querySelector(".work-piece-slider-btn.is-next");
    const total = slides.length;
    let index = 0;
    let startX = 0;
    let trackingSwipe = false;

    if (!track || total === 0) {
      return;
    }

    function goTo(nextIndex) {
      index = ((nextIndex % total) + total) % total;
      const width = viewport ? viewport.clientWidth : root.clientWidth;
      track.style.transform = "translateX(" + -index * width + "px)";
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
      });
    }

    window.addEventListener("resize", function () {
      goTo(index);
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goTo(index - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goTo(index + 1);
      });
    }

    root.addEventListener("pointerdown", function (event) {
      if (event.target.closest(".work-piece-slider-btn")) {
        return;
      }
      trackingSwipe = true;
      startX = event.clientX;
    });

    root.addEventListener("pointerup", function (event) {
      if (!trackingSwipe) {
        return;
      }
      trackingSwipe = false;
      const delta = event.clientX - startX;
      if (Math.abs(delta) < 40) {
        return;
      }
      goTo(index + (delta < 0 ? 1 : -1));
    });

    root.addEventListener("pointerleave", function () {
      trackingSwipe = false;
    });
  }

  document.querySelectorAll("[data-work-slider]").forEach(initSlider);

  document.querySelectorAll(".work-piece").forEach(function (piece) {
    const expand = piece.querySelector(".work-piece-expand");
    const entry = piece.closest(".work-entry");
    const enquire = entry && entry.querySelector(".work-piece-enquire");
    const titleEl = piece.querySelector(".work-piece-title");

    if (
      enquire &&
      enquire.classList.contains("work-piece-enquire") &&
      titleEl
    ) {
      const title = titleEl.textContent.trim();
      enquire.href =
        "./index.html?enquire=post&title=" +
        encodeURIComponent(title) +
        "#serviceRequest";
    }

    if (!expand) {
      return;
    }

    let animating = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function collapsedHeight() {
      const raw = getComputedStyle(piece)
        .getPropertyValue("--work-collapsed")
        .trim();
      const value = parseFloat(raw);
      if (raw.indexOf("rem") !== -1) {
        return (
          value *
          parseFloat(getComputedStyle(document.documentElement).fontSize)
        );
      }
      return value || piece.offsetHeight;
    }

    function finishHeight() {
      animating = false;
      if (piece.classList.contains("is-expanded")) {
        piece.style.height = "auto";
      } else {
        piece.style.height = "";
      }
    }

    function onHeightEnd(event) {
      if (event.propertyName !== "height") {
        return;
      }
      finishHeight();
    }

    piece.addEventListener("transitionend", onHeightEnd);

    expand.addEventListener("click", function () {
      if (animating) {
        return;
      }

      const open = !piece.classList.contains("is-expanded");
      expand.setAttribute("aria-expanded", String(open));
      expand.setAttribute(
        "aria-label",
        open ? "Collapse this work" : "Expand this work"
      );

      if (reduceMotion.matches) {
        piece.classList.toggle("is-expanded", open);
        piece.style.height = "";
        return;
      }

      animating = true;

      if (open) {
        const start = piece.offsetHeight;
        piece.classList.add("is-expanded");
        piece.style.height = "auto";
        const end = piece.offsetHeight;
        piece.style.height = start + "px";
        piece.offsetHeight;
        piece.style.height = end + "px";
        window.setTimeout(function () {
          if (animating) {
            finishHeight();
          }
        }, 700);
        return;
      }

      const start = piece.offsetHeight;
      piece.style.height = start + "px";
      piece.offsetHeight;
      piece.classList.remove("is-expanded");
      piece.style.height = collapsedHeight() + "px";
      window.setTimeout(function () {
        if (animating) {
          finishHeight();
        }
      }, 700);
    });
  });
})();
