// Injects a script to send a message when rightmove page model is available.
// Avoids CORS error.
export function injectExternalScriptToNotifyWhenRightmovePageModelAvailable() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injectScript.js");
  document.documentElement.appendChild(script);
  script.onload = () => script.remove();
}
