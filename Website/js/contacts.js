(function initContactTitle() {
  const stage = document.querySelector(".contacts-stage");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!stage) {
    return;
  }

  function reveal() {
    const viewer = stage.querySelector("model-viewer");
    if (reduceMotion.matches) {
      if (viewer) {
        viewer.removeAttribute("auto-rotate");
      }
      stage.classList.add("is-title-in");
      return;
    }

    window.requestAnimationFrame(function () {
      stage.classList.add("is-title-in");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal);
  } else {
    reveal();
  }
})();

(function initCollaborations() {
  const stage = document.querySelector(".collaborations-stage");
  const form = document.getElementById("collaborationEnquiryForm");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mailTo = "sai.prakhya@xtrudeinc.com";
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

  function showCollaborations() {
    if (stage) {
      stage.classList.add("is-in");
    }
  }

  if (stage) {
    if (reduceMotion.matches) {
      showCollaborations();
    } else if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              showCollaborations();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.28 }
      );
      observer.observe(stage);
    } else {
      showCollaborations();
    }
  }

  if (!form) {
    return;
  }

  const status = form.querySelector(".collaborations-status");
  const button = form.querySelector("[type='submit']");
  const otherWrap = form.querySelector(".collaborations-other");
  const otherBox = form.querySelector("[data-service-other]");
  const otherInput = form.elements.namedItem("serviceOther");

  function setStatus(message, ok) {
    if (!status) {
      return;
    }
    status.hidden = !message;
    status.textContent = message;
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
    if (serviceAliases[key]) {
      return serviceAliases[key];
    }
    return "";
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
  if (applyServiceFromQuery()) {
    showCollaborations();
    if (stage && stage.scrollIntoView) {
      window.requestAnimationFrame(function () {
        stage.scrollIntoView({
          behavior: reduceMotion.matches ? "auto" : "smooth",
          block: "start",
        });
      });
    }
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

    const phoneDigits = phone.replace(/\D/g, "");
    if (!name || !email || !message) {
      setStatus("Please fill in your name, email, and project description.", false);
      return;
    }
    if (phoneDigits.length < 10) {
      setStatus("Please enter a valid contact number so we can confirm on WhatsApp.", false);
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
    if (button) {
      button.disabled = true;
    }
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
        if (button) {
          button.disabled = false;
        }
      });
  });
})();
