// Injects a script to send a message when rightmove page model is available.
// Avoids CORS error.
export function injectExternalScriptToNotifyWhenRightmovePageModelAvailable() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injectScript.js");
  document.documentElement.appendChild(script);
  // DO NOT REMOVE THE SCRIPT ONLOAD ANYMORE - let injectScript.js run its polling course
  // script.onload = () => script.remove();
}
