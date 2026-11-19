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

(function initServicesDropdowns() {
  const items = document.querySelectorAll(".services-dropdown");
  if (!items.length) {
    return;
  }

  function setOpen(item, open) {
    item.classList.toggle("is-open", open);
    const toggle = item.querySelector(".services-dropdown-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  items.forEach(function (item) {
    const toggle = item.querySelector(".services-dropdown-toggle");
    if (!toggle) {
      return;
    }

    toggle.addEventListener("click", function () {
      const willOpen = !item.classList.contains("is-open");
      items.forEach(function (other) {
        setOpen(other, willOpen && other === item);
      });
    });
  });
})();

(function initServicesCloser() {
  const closer = document.querySelector(".services-closer");
  const title = closer && closer.querySelector(".services-closer-title");
  const typed = title && title.querySelector(".services-closer-typed");
  const fullText = title && (title.getAttribute("data-type-text") || "");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let typeTimer = 0;
  let started = false;

  if (!closer || !title) {
    return;
  }

  function finish() {
    if (typed) {
      typed.textContent = fullText;
    }
    title.classList.add("is-typed");
    closer.classList.add("is-typed");
  }

  function start() {
    if (started) {
      return;
    }
    started = true;
    window.clearTimeout(typeTimer);
    title.classList.remove("is-typed");
    closer.classList.remove("is-typed");

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

  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.intersectionRatio >= 0.32) {
          start();
          observer.disconnect();
        }
      });
    },
    { threshold: [0.32, 0.45] }
  );

  observer.observe(closer);
})();

(function initServicesProducts() {
  const section = document.querySelector(".services-products");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!section) {
    return;
  }

  function reveal() {
    section.classList.add("is-in");
  }

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    reveal();
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.intersectionRatio >= 0.18) {
          reveal();
          observer.disconnect();
        }
      });
    },
    { threshold: [0.18, 0.32] }
  );

  observer.observe(section);
})();

(function initProductSlideshows() {
  const shows = document.querySelectorAll(".product-slideshow");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!shows.length) {
    return;
  }

  shows.forEach(function (show) {
    const slides = show.querySelectorAll("img");
    if (slides.length < 2) {
      return;
    }

    slides.forEach(function (slide, index) {
      slide.classList.toggle("is-active", index === 0);
    });

    if (reduceMotion.matches) {
      return;
    }

    let index = 0;
    const delay = Number(show.getAttribute("data-interval")) || 4200;

    window.setInterval(function () {
      slides[index].classList.remove("is-active");
      index = (index + 1) % slides.length;
      slides[index].classList.add("is-active");
    }, delay);
  });
})();

(function initServiceEnquiryForm() {
  const form = document.getElementById("serviceEnquiryForm");
  const status = form && form.querySelector(".services-enquiry-status");
  const button = form && form.querySelector("[type='submit']");

  if (!form || !status || !button) {
    return;
  }

  function setStatus(message, ok) {
    status.hidden = !message;
    status.textContent = message;
    status.classList.toggle("is-ok", Boolean(ok));
    status.classList.toggle("is-err", !ok && Boolean(message));
  }

  form.setAttribute("novalidate", "");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = (form.elements.namedItem("name") && form.elements.namedItem("name").value || "").trim();
    const email = (form.elements.namedItem("email") && form.elements.namedItem("email").value || "").trim();
    const phone = (form.elements.namedItem("phone") && form.elements.namedItem("phone").value || "").trim();
    const service = (form.elements.namedItem("service") && form.elements.namedItem("service").value || "").trim();
    const requirement = (form.elements.namedItem("requirement") && form.elements.namedItem("requirement").value || "").trim();

    if (!name || !email || !phone || !service || !requirement) {
      setStatus("Please fill in your name, email, WhatsApp number, service, and requirements.", false);
      return;
    }

    const body = new FormData(form);
    button.disabled = true;
    setStatus("Sending your enquiry…", true);

    fetch("/php/send-service-request.php", {
      method: "POST",
      body: body,
    })
      .then(function (response) {
        return response.json().then(
          function (data) {
            return { ok: response.ok, data: data };
          },
          function () {
            return { ok: false, data: { success: false, message: "" } };
          }
        );
      })
      .then(function (result) {
        const message =
          (result.data && result.data.message) ||
          (result.ok
            ? "Request sent. Check your email for the full enquiry."
            : "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.");
        setStatus(message, result.ok && result.data && result.data.success);
        if (result.ok && result.data && result.data.success) {
          form.reset();
        }
      })
      .catch(function () {
        setStatus(
          "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.",
          false
        );
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
