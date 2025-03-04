// This script handles the login success page functionality
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  // Remove the auth code handling section completely
  // Let the background script handle this as before

  // Set up timer and close button after verifying elements exist
  const timerElement = document.getElementById("timer");
  const closeButton = document.getElementById("closeButton");

  if (!timerElement || !closeButton) {
    console.error("Required elements not found");
    return;
  }

  // Function to close the tab
  function closeTab() {
    console.log("Closing tab...");
    chrome.runtime.sendMessage({ type: "authSuccess" }, function (response) {
      console.log("Response from close message:", response);
      window.close();
    });
  }

  // Set up countdown timer
  let seconds = 5;
  timerElement.textContent = seconds;
  const interval = setInterval(function () {
    seconds--;
    console.log("Timer: " + seconds);
    timerElement.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(interval);
      closeTab();
    }
  }, 1000);

  // Set up close button
  closeButton.addEventListener("click", function () {
    console.log("Close button clicked");
    clearInterval(interval);
    closeTab();
  });
});
