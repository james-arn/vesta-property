console.log("Background script loaded");

// Enable opening the side panel when the action button is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error)); 