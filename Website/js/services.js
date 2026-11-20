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
  const stage = document.getElementById("serviceEnquiry");
  const status = form && form.querySelector(".services-enquiry-status");
  const button = form && form.querySelector("[type='submit']");
  const mailTo = "sai.prakhya@xtrudeinc.com";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const serviceAliases = {
    "product-conceptualization": "Product Conceptualization",
    "product conceptualization": "Product Conceptualization",
    "industrial-design-cad": "Industrial Design & CAD",
    "industrial design & cad": "Industrial Design & CAD",
    "industrial design and cad": "Industrial Design & CAD",
    "prototyping": "Prototyping",
    "dfm-engineering": "DFM & Engineering",
    "dfm & engineering": "DFM & Engineering",
    "dfm and engineering": "DFM & Engineering",
    "end-to-end-product-development": "End-to-end product development",
    "end-to-end product development": "End-to-end product development",
    "end to end product development": "End-to-end product development",
  };

  if (!form || !status || !button) {
    return;
  }

  const otherWrap = form.querySelector(".services-enquiry-other");
  const otherBox = form.querySelector("[data-service-other]");
  const otherInput = form.elements.namedItem("serviceOther");

  function setStatus(message, ok) {
    status.hidden = !message;
    status.textContent = message;
    status.classList.toggle("is-ok", Boolean(ok));
    status.classList.toggle("is-err", !ok && Boolean(message));
  }

  function selectedServices() {
    return Array.prototype.map
      .call(form.querySelectorAll('input[name="services"]:checked'), function (input) {
        return input.value;
      })
      .filter(Boolean);
  }

  function syncOther() {
    const on = Boolean(otherBox && otherBox.checked);
    if (otherWrap) {
      otherWrap.hidden = !on;
    }
    if (otherInput && !on) {
      otherInput.value = "";
    }
  }

  function combineServices(choices, typedOther) {
    const other = (typedOther || "").trim();
    const labels = [];
    choices.forEach(function (choice) {
      if (choice === "Other") {
        labels.push(other || "Other");
      } else if (labels.indexOf(choice) === -1) {
        labels.push(choice);
      }
    });
    if (other && labels.indexOf(other) === -1 && choices.indexOf("Other") === -1) {
      labels.push(other);
    }
    return labels;
  }

  function enquirySubject(services, organization) {
    const company = organization || "Not specified";
    const kind = services.length === 1 ? services[0] : "New Project Enquiry";
    return kind + " | XtrudeInc | " + company;
  }

  function enquiryBody(details) {
    return [
      "New Project Enquiry",
      "Website Submission",
      "",
      "Contact information",
      "Name: " + details.name,
      "Email: " + details.email,
      "Contact Number: " + details.phone,
      "Organisation or Company Name: " + details.organization,
      "Website Link: " + details.website,
      "LinkedIn: " + details.linkedin,
      "Other socials: " + details.socials,
      "",
      "Project information:",
      "Service requested: " + details.service,
      "Project description: " + details.message,
      "Expected timeline: " + details.timeline,
      "",
      "Additional information",
      "Reference files: Please add reference images in this email.",
      "Reply directly to the sender to initiate discussions.",
    ].join("\n");
  }

  function canonicalService(raw) {
    const key = raw.replace(/\+/g, " ").replace(/_/g, " ").trim().toLowerCase();
    return serviceAliases[key] || "";
  }

  function applyServiceFromQuery() {
    const raw = (new URLSearchParams(window.location.search).get("service") || "").trim();
    if (!raw) {
      return false;
    }
    const known = canonicalService(raw);
    const boxes = form.querySelectorAll('input[name="services"]');
    let matched = false;
    if (known) {
      Array.prototype.forEach.call(boxes, function (box) {
        if (box.value === known) {
          box.checked = true;
          matched = true;
        }
      });
    }
    if (!matched && otherBox) {
      otherBox.checked = true;
      if (otherInput) {
        otherInput.value = raw.replace(/\+/g, " ").trim();
      }
    }
    syncOther();
    return true;
  }

  form.addEventListener("change", function (event) {
    if (event.target && event.target.name === "services") {
      syncOther();
    }
  });

  form.setAttribute("novalidate", "");
  syncOther();

  function scrollToEnquiry() {
    if (!stage || !stage.scrollIntoView) {
      return;
    }
    function go() {
      stage.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start",
      });
    }
    window.requestAnimationFrame(go);
    window.setTimeout(go, 320);
  }

  const fromQuery = applyServiceFromQuery();
  const fromHash = window.location.hash === "#serviceEnquiry";
  if (fromQuery || fromHash) {
    scrollToEnquiry();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = ((form.elements.namedItem("name") && form.elements.namedItem("name").value) || "").trim();
    const email = ((form.elements.namedItem("email") && form.elements.namedItem("email").value) || "").trim();
    const phone = ((form.elements.namedItem("phone") && form.elements.namedItem("phone").value) || "").trim();
    const organization = ((form.elements.namedItem("organization") && form.elements.namedItem("organization").value) || "").trim();
    const website = ((form.elements.namedItem("website") && form.elements.namedItem("website").value) || "").trim();
    const linkedin = ((form.elements.namedItem("linkedin") && form.elements.namedItem("linkedin").value) || "").trim();
    const socials = ((form.elements.namedItem("socials") && form.elements.namedItem("socials").value) || "").trim();
    const message = ((form.elements.namedItem("message") && form.elements.namedItem("message").value) || "").trim();
    const timeline = ((form.elements.namedItem("timeline") && form.elements.namedItem("timeline").value) || "").trim();
    const typedOther = ((otherInput && otherInput.value) || "").trim();
    const services = combineServices(selectedServices(), typedOther);

    if (!name || !email || !message) {
      setStatus("Please fill in your name, email, and project description.", false);
      return;
    }
    if (!services.length) {
      setStatus("Please choose a service, or describe it under Other.", false);
      return;
    }
    if (otherBox && otherBox.checked && !typedOther) {
      setStatus("Please describe the service under Other.", false);
      return;
    }

    const serviceLabel = services.join(", ");
    const company = organization || "Not specified";
    const subject = enquirySubject(services, company);
    const bodyText = enquiryBody({
      name: name,
      email: email,
      phone: phone || "Not specified",
      organization: company,
      website: website || "Not specified",
      linkedin: linkedin || "Not specified",
      socials: socials || "Not specified",
      service: serviceLabel,
      message: message,
      timeline: timeline || "To be discussed.",
    });
    const gmailUrl =
      "https://mail.google.com/mail/?view=cm&fs=1&to=" +
      encodeURIComponent(mailTo) +
      "&su=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(bodyText);

    const body = new FormData(form);
    body.delete("services");
    body.set("kind", "collaboration");
    body.set("service", serviceLabel);
    body.set("serviceOther", typedOther);
    body.set("timeline", timeline);
    button.disabled = true;
    setStatus("Sending your enquiry…", true);

    function openGmail() {
      const opened = window.open(gmailUrl, "_blank", "noopener");
      if (!opened) {
        window.location.href = gmailUrl;
      }
    }

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
        const emailed = Boolean(result.ok && result.data && result.data.success);
        if (emailed) {
          setStatus("Enquiry sent. Opening email to add reference images…", true);
          form.reset();
          syncOther();
        } else {
          setStatus("Opening email so you can send the enquiry and add reference images…", false);
        }
        openGmail();
      })
      .catch(function () {
        setStatus("Could not send from the site. Opening Gmail…", false);
        openGmail();
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
