document.addEventListener("DOMContentLoaded", () => {
  const modelViewer = document.getElementById("modelViewer");
  const applyBtn = document.getElementById("ApplyBtn");
  const textInput = document.getElementById("textInput");

  //This block waits for the model to load fully.
  modelViewer.addEventListener("load", () => {
    console.log("Model loaded");

    modelViewer.isContentEditable.traverse((obj) => {
      if (obj.isMesh) {
        console.log("Mesh found: ", obj.name);
      }
    });
  });
});
