(function initServiceRequestForm() {
  const form = document.getElementById("serviceRequestForm");
  if (!form) {
    return;
  }

  const nameInput = document.getElementById("serviceName");
  const businessInput = document.getElementById("serviceBusiness");
  const requirementInput = document.getElementById("serviceRequirement");
  const enquireNote = document.getElementById("serviceWorkEnquireNote");
  const status = document.getElementById("serviceFormStatus");
  const submitButton = form.querySelector(".services-send-btn");
  const sendWrap = form.querySelector(".services-send-wrap");
  const whatsappNumber = "918904424961";
  const confettiColors = ["#01204e", "#028393", "#faaa68", "#f65625"];
  let celebrateTimer = 0;
  const enquireParams = new URLSearchParams(window.location.search);
  const enquireTitle = (enquireParams.get("title") || "").trim();
  const isWorkEnquire =
    enquireParams.get("enquire") === "post" && enquireTitle !== "";
  const workEnquireMessage = isWorkEnquire
    ? 'I would like to enquire about this post: "' + enquireTitle + '".'
    : "";

  function applyWorkEnquire() {
    if (!isWorkEnquire || !requirementInput) {
      return;
    }

    requirementInput.value = workEnquireMessage;
    requirementInput.removeAttribute("required");
    form.classList.add("is-work-enquire");

    if (enquireNote) {
      enquireNote.hidden = false;
      enquireNote.textContent =
        'This enquiry is about the Our Work post: "' + enquireTitle + '".';
    }

    if (window.location.hash === "#serviceRequest") {
      const section = document.getElementById("serviceRequest");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (nameInput) {
      nameInput.focus();
    }
  }

  function showStatus(message, kind) {
    if (!status) {
      return;
    }
    status.hidden = !message;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (kind) {
      status.classList.add(kind);
    }
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function buildMessage() {
    const name = nameInput.value.trim();
    const business = businessInput.value.trim() || "None";
    const requirement = requirementInput.value.trim();

    return (
      "Name: " +
      name +
      "\nBusiness name: " +
      business +
      "\nRequirement: " +
      requirement +
      "\nDate: " +
      formatDate(new Date())
    );
  }

  function openWhatsApp(message) {
    const url =
      "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener");
  }

  function burstConfetti() {
    if (!sendWrap) {
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      return;
    }

    for (let i = 0; i < 28; i += 1) {
      const piece = document.createElement("span");
      const dx = (Math.random() * 220 - 110).toFixed(0) + "px";
      const dy = (Math.random() * -120 - 20).toFixed(0) + "px";
      const rot = (Math.random() * 540 - 270).toFixed(0) + "deg";
      piece.className = "services-confetti";
      piece.style.background = confettiColors[i % confettiColors.length];
      piece.style.setProperty("--dx", dx);
      piece.style.setProperty("--dy", dy);
      piece.style.setProperty("--rot", rot);
      piece.style.left = 18 + Math.random() * 64 + "%";
      piece.style.width = 6 + Math.random() * 6 + "px";
      piece.style.height = 6 + Math.random() * 8 + "px";
      sendWrap.appendChild(piece);
      window.setTimeout(function () {
        piece.remove();
      }, 1000);
    }
  }

  function celebrateSend() {
    if (!submitButton) {
      return;
    }
    window.clearTimeout(celebrateTimer);
    submitButton.disabled = true;
    submitButton.textContent = "message sent!";
    window.requestAnimationFrame(function () {
      submitButton.classList.add("is-sent");
    });
    burstConfetti();
    celebrateTimer = window.setTimeout(function () {
      submitButton.classList.remove("is-sent");
      submitButton.textContent = "Send";
      submitButton.disabled = false;
    }, 1000);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showStatus("");

    if (!nameInput.value.trim() || !requirementInput.value.trim()) {
      showStatus(
        isWorkEnquire
          ? "Please fill in your name."
          : "Please fill in your name and requirements.",
        "is-error"
      );
      return;
    }

    openWhatsApp(buildMessage());
    form.reset();
    if (isWorkEnquire) {
      requirementInput.value = workEnquireMessage;
    }
    celebrateSend();
  });

  applyWorkEnquire();
})();
