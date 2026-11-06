//AOS.init();
// const customizeBtn = document.querySelectorAll(".customizeBtn");
// const placeorderBtn = document.querySelectorAll(".placeorderBtn");

// customizeBtn.forEach((btn) => {
//   btn.addEventListener("click", () => {
//     console.log("Hello!");
//   });
// });

// placeorderBtn.forEach((btn) => {
//   btn.addEventListener("click", () => {
//     console.log("Hello!");
//   });
// });

// const dialogueBox = document.querySelector(".ShowcaseDialogueBox");
// const closeBtn = document.querySelector(".closeBtn");

const dialogueBox = document.querySelector(".ShowcaseDialogueBox");
const dialogueText = document.querySelector(".dialogueText");
const closeBtn = document.querySelector(".closeBtn");

function showMessageForCustomizeBtn() {
  const dialogueBox = document.querySelector(".ShowcaseDialogueBox");
  const dialogueText = document.querySelector(".dialogueText");
  const closeBtn = document.querySelector(".closeBtn");

  dialogueBox.style.display = "flex";
  dialogueText.style.display = "block";
  //dialogueBox.zIndex = "999";

  closeBtn.onclick = function () {
    dialogueBox.style.display = "none";
    dialogueText.style.display = "none";
  };
}

(function initProductsSlider() {
  const root = document.getElementById("productsSlider");
  if (!root) {
    return;
  }

  const track = root.querySelector(".products-slider-track");
  const slides = Array.from(root.querySelectorAll(".products-slider-slide"));
  const prevBtn = root.querySelector(".products-slider-prev");
  const nextBtn = root.querySelector(".products-slider-next");
  const dots = Array.from(root.querySelectorAll(".products-slider-dot"));
  const viewport = root.querySelector(".products-slider-viewport");
  const total = slides.length;
  let index = 0;
  let startX = 0;
  let startY = 0;
  let trackingSwipe = false;

  function goTo(nextIndex) {
    index = ((nextIndex % total) + total) % total;
    track.style.transform = "translateX(" + -index * 100 + "%)";
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === index);
    });
    dots.forEach(function (dot, i) {
      const isActive = i === index;
      dot.classList.toggle("is-active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  }

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

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      goTo(i);
    });
  });

  root.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    }
  });

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    trackingSwipe = true;
    startX = event.clientX;
    startY = event.clientY;
  }

  function onPointerUp(event) {
    if (!trackingSwipe) {
      return;
    }
    trackingSwipe = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    if (dx < 0) {
      goTo(index + 1);
    } else {
      goTo(index - 1);
    }
  }

  if (viewport) {
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", function () {
      trackingSwipe = false;
    });
  }

  goTo(0);
})();
