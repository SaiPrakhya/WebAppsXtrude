(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useViewTransition = "startViewTransition" in document;

  function showPage() {
    root.classList.remove("is-page-leaving");
    root.classList.add("is-page-ready");
  }

  if (!useViewTransition) {
    root.classList.add("is-page-fade");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showPage);
  } else {
    showPage();
  }

  window.addEventListener("pageshow", showPage);

  if (reduceMotion || useViewTransition) {
    return;
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = event.target.closest("a");
    if (!link || !link.href || link.hasAttribute("download")) {
      return;
    }
    if (link.target && link.target !== "_self") {
      return;
    }

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    if (url.origin !== window.location.origin) {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return;
    }

    const current = window.location;
    if (url.pathname === current.pathname && url.search === current.search) {
      return;
    }

    event.preventDefault();
    root.classList.remove("is-page-ready");
    root.classList.add("is-page-leaving");
    window.setTimeout(function () {
      window.location.href = link.href;
    }, 260);
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (finePointer.matches) {
    const root = document.documentElement;
    root.classList.add("has-site-cursor");

    const cursor = document.createElement("div");
    cursor.className = "site-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    const clickableSelector =
      "a[href], button:not(:disabled), [role='button'], summary, label, select, input[type='button'], input[type='submit'], input[type='reset'], input[type='checkbox'], input[type='radio'], input[type='file'], .experience-close-mark";

    function isClickable(target) {
      return Boolean(target && target.closest && target.closest(clickableSelector));
    }

    function moveCursor(event) {
      const finger = isClickable(event.target);
      cursor.classList.toggle("is-finger", finger);
      cursor.classList.add("is-on");
      cursor.classList.remove("is-hidden");
      const offsetX = finger ? 14 : 8;
      const offsetY = finger ? 3 : 6;
      cursor.style.transform =
        "translate3d(" +
        (event.clientX - offsetX) +
        "px, " +
        (event.clientY - offsetY) +
        "px, 0)";
    }

    document.addEventListener("mousemove", moveCursor, { passive: true });
    document.addEventListener("pointermove", moveCursor, { passive: true });
    document.addEventListener("pointerdown", moveCursor, true);
    document.addEventListener("pointerup", moveCursor, true);

    document.addEventListener("mouseleave", function () {
      cursor.classList.add("is-hidden");
    });

    document.addEventListener("mouseenter", function () {
      cursor.classList.remove("is-hidden");
    });
  }

  const header = document.querySelector(".site-header");
  const hamburger = document.getElementById("hamburger");
  const drawer = document.getElementById("nav-drawer");
  const overlay = document.getElementById("nav-overlay");
  const drawerLinks = drawer ? drawer.querySelectorAll("a") : [];

  function headerOffset() {
    if (!header) {
      return 88;
    }
    return header.getBoundingClientRect().height + 12;
  }

  function scrollToHash(hash) {
    if (hash === "#heroContainer" || hash === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const id = hash.replace(/^#/, "");
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    const top = Math.max(
      0,
      target.getBoundingClientRect().top + window.scrollY - headerOffset()
    );
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  function setMenuOpen(isOpen) {
    if (!hamburger || !drawer || !overlay) {
      return;
    }

    hamburger.classList.toggle("is-open", isOpen);
    drawer.classList.toggle("is-open", isOpen);
    overlay.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);

    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    drawer.setAttribute("aria-hidden", String(!isOpen));
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!header) {
        return;
      }
      header.classList.toggle("scrolled", window.scrollY > 50);
    },
    { passive: true }
  );

  if (hamburger && drawer && overlay) {
    hamburger.addEventListener("click", function (event) {
      event.stopPropagation();
      setMenuOpen(!drawer.classList.contains("is-open"));
    });

    overlay.addEventListener("click", function () {
      setMenuOpen(false);
    });

    drawerLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    });
  }

  const aboutNav = document.querySelector(".site-top-nav");
  if (aboutNav) {
    const toggle = aboutNav.querySelector(".site-top-nav-toggle");
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let closeTimer = 0;

    function setAboutNav(open) {
      aboutNav.classList.toggle("is-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      }
    }

    function openAboutNav() {
      window.clearTimeout(closeTimer);
      setAboutNav(true);
    }

    function closeAboutNav() {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () {
        setAboutNav(false);
      }, 180);
    }

    aboutNav.addEventListener("mouseenter", openAboutNav);
    aboutNav.addEventListener("mouseleave", closeAboutNav);
    aboutNav.addEventListener("focusin", openAboutNav);
    aboutNav.addEventListener("focusout", function (event) {
      if (!aboutNav.contains(event.relatedTarget)) {
        closeAboutNav();
      }
    });

    if (toggle) {
      toggle.addEventListener("click", function (event) {
        if (canHover) {
          return;
        }
        event.preventDefault();
        window.clearTimeout(closeTimer);
        setAboutNav(!aboutNav.classList.contains("is-open"));
      });
    }
  }

  function setupTypeTitle(title, startMode) {
    if (!title) {
      return;
    }

    const typed = title.querySelector(".what-we-do-typed");
    const stage = title.closest("section");
    const fullText = title.getAttribute("data-type-text") || "";
    let typeTimer = 0;
    let started = false;

    function finish() {
      if (typed) {
        typed.textContent = fullText;
      }
      title.classList.add("is-typed");
      if (stage) {
        stage.classList.add("is-typed");
      }
    }

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.clearTimeout(typeTimer);
      title.classList.remove("is-typed");
      if (stage) {
        stage.classList.remove("is-typed");
      }
      if (!typed) {
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

      typeTimer = window.setTimeout(step, 280);
    }

    if (startMode === "view" && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              start();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(stage || title);
    } else {
      start();
    }
  }

  setupTypeTitle(document.querySelector("body.about-page .what-we-do-title"), "load");
  setupTypeTitle(document.querySelector("body.about-page .experience-close-title"), "view");

  document.querySelectorAll("body.about-page .what-we-do-actions a[href='#the-experience']").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const target = document.getElementById("the-experience");
      if (!target) {
        return;
      }
      const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
        block: "start"
      });
      if (history.replaceState) {
        history.replaceState(null, "", "#the-experience");
      }
    });
  });

});
