// This script handles the logout success page functionality
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded in logout page");

  // Set up timer and close button after verifying elements exist
  const timerElement = document.getElementById("timer");
  const closeButton = document.getElementById("closeButton");

  if (!timerElement || !closeButton) {
    console.error("Required elements not found in logout page");
    return;
  }

  // Function to close the tab
  function closeTab() {
    console.log("Closing logout tab...");
    chrome.runtime.sendMessage({ type: "logoutSuccess" }, function (response) {
      console.log("Response from close message:", response);
      window.close();
    });
  }

  // Set up countdown timer
  let seconds = 5;
  timerElement.textContent = seconds;
  const interval = setInterval(function () {
    seconds--;
    console.log("Logout timer: " + seconds);
    timerElement.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(interval);
      closeTab();
    }
  }, 1000);

  // Set up close button
  closeButton.addEventListener("click", function () {
    console.log("Logout close button clicked");
    clearInterval(interval);
    closeTab();
  });
});
