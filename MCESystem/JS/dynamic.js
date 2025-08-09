window.onload = function () {
  console.log("Page loaded successfully!");

  const button1 = document.querySelector("#Opt1");

  button1.addEventListener("click", function () {
    console.log("Button 1 clicked!");
    // Button logic
    const dashboardContainer = document.getElementsByClassName(
      "dashboard-container"
    );

    const opt1Editor = document.getElementsByClassName("Opt1editor");

    dashboardContainer[0].style.display = "none";
    opt1Editor[0].style.display = "flex";
  });
};
