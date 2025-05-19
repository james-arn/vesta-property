import { injectExternalScriptToNotifyWhenRightmovePageModelAvailable } from "./dom/injectScriptHandler";
import { createAndInjectPullTab } from "./dom/pullTab";
import { setupContentScriptEventListeners } from "./events/contentScriptEventListeners";

// ContentScript.ts: Main entry point for the content script.
// Responsibilities:
// 1. Initialize listeners (window messages, chrome runtime messages).
// 2. Inject the script to access the page's JavaScript context (for PAGE_MODEL).
// 3. Inject the initial UI elements (like the pull tab).

console.log("[ContentScript] Initializing...");

// Setup listeners that will receive messages and delegate to handlers
setupContentScriptEventListeners();

// Inject the script that listens for PAGE_MODEL and sends it via window.postMessage
injectExternalScriptToNotifyWhenRightmovePageModelAvailable();

// Create the pull tab UI element once on initialization
createAndInjectPullTab();

console.log("[ContentScript] Initialization complete.");

// State and handlers are now managed in contentScriptHandlers.ts
