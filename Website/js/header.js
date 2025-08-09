window.onload = function () {
  console.log("All booted up!");

  window.addEventListener("scroll", function () {
    const header = document.querySelector(".site-header");
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
};
