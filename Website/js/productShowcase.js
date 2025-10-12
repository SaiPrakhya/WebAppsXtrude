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
