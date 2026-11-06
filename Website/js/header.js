document.addEventListener("DOMContentLoaded", function () {
  const header = document.querySelector(".site-header");
  const hamburger = document.getElementById("hamburger");
  const drawer = document.getElementById("nav-drawer");
  const overlay = document.getElementById("nav-overlay");
  const navLinks = drawer ? drawer.querySelectorAll("a") : [];

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

    navLinks.forEach(function (link) {
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
});
