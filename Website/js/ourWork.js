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

(function initOurWorkStage() {
  const stage = document.querySelector(".our-work-stage");
  const title = document.querySelector(".our-work-title");
  const intro = document.querySelector(".our-work-intro");
  const typed = intro && intro.querySelector(".our-work-typed");
  const fullText = intro && intro.getAttribute("data-type-text");
  const viewLink = document.querySelector('.our-work-actions a[href="#portfolio"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let typeTimer = 0;
  let started = false;

  if (!stage || !title || !intro) {
    return;
  }

  function finishType() {
    if (typed) {
      typed.textContent = fullText || "";
    }
    intro.classList.add("is-typed");
    stage.classList.add("is-typed");
  }

  function startType() {
    if (started) {
      return;
    }
    started = true;
    window.clearTimeout(typeTimer);
    intro.classList.remove("is-typed");
    stage.classList.remove("is-typed");

    if (!typed || !fullText) {
      finishType();
      return;
    }

    if (reduceMotion.matches) {
      finishType();
      return;
    }

    typed.textContent = "";
    let index = 0;

    function step() {
      if (index < fullText.length) {
        typed.textContent = fullText.slice(0, index + 1);
        index += 1;
        typeTimer = window.setTimeout(step, 56);
      } else {
        typeTimer = window.setTimeout(finishType, 280);
      }
    }

    typeTimer = window.setTimeout(step, 180);
  }

  function showTitle() {
    if (reduceMotion.matches) {
      stage.classList.add("is-title-in");
      startType();
      return;
    }

    window.requestAnimationFrame(function () {
      stage.classList.add("is-title-in");
    });
    window.setTimeout(startType, 620);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showTitle);
  } else {
    showTitle();
  }

  if (viewLink) {
    viewLink.addEventListener("click", function (event) {
      event.preventDefault();
      const target = document.getElementById("portfolio");
      if (!target) {
        return;
      }
      target.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      if (history.replaceState) {
        history.replaceState(null, "", "#portfolio");
      }
    });
  }
})();

(function initPortfolioHeading() {
  const portfolio = document.querySelector(".our-work-portfolio");
  const heading = document.querySelector(".portfolio-heading");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!portfolio || !heading) {
    return;
  }

  function reveal() {
    portfolio.classList.add("is-heading-in");
  }

  if (reduceMotion.matches) {
    reveal();
    return;
  }

  if (!("IntersectionObserver" in window)) {
    reveal();
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );

  observer.observe(heading);
})();

(function initCaseStudyMotion() {
  const back = document.querySelector(".case-study-back");
  const titles = document.querySelectorAll(".case-study-title[data-type-text]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!back && !titles.length) {
    return;
  }

  function typeTitle(title) {
    const typed = title.querySelector(".case-study-typed");
    const fullText = title.getAttribute("data-type-text") || "";
    let typeTimer = 0;
    let started = false;

    function finish() {
      if (typed) {
        typed.textContent = fullText;
      }
      title.classList.add("is-typed");
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.clearTimeout(typeTimer);
      title.classList.remove("is-typed");

      if (!typed || !fullText || reduceMotion.matches) {
        finish();
        return;
      }

      typed.textContent = "";
      let index = 0;

      function step() {
        if (index < fullText.length) {
          typed.textContent = fullText.slice(0, index + 1);
          index += 1;
          typeTimer = window.setTimeout(step, 56);
        } else {
          typeTimer = window.setTimeout(finish, 280);
        }
      }

      typeTimer = window.setTimeout(step, 180);
    }

    return start;
  }

  const startOrigin = titles[0] ? typeTitle(titles[0]) : function () {};
  const startConcept = titles[1] ? typeTitle(titles[1]) : function () {};

  function fadeBack(done) {
    if (!back) {
      if (done) {
        done();
      }
      return;
    }

    if (reduceMotion.matches) {
      back.classList.add("is-in");
      if (done) {
        done();
      }
      return;
    }

    window.requestAnimationFrame(function () {
      back.classList.add("is-in");
    });
    window.setTimeout(function () {
      if (done) {
        done();
      }
    }, 560);
  }

  function watchConcept() {
    if (!titles[1]) {
      return;
    }

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      startConcept();
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.intersectionRatio >= 0.32) {
            startConcept();
            observer.disconnect();
          }
        });
      },
      { threshold: [0.32, 0.5] }
    );

    observer.observe(titles[1]);
  }

  function boot() {
    fadeBack(startOrigin);
    watchConcept();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
