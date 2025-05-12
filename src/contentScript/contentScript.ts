import { injectExternalScriptToNotifyWhenRightmovePageModelAvailable } from "./dom/injectScriptHandler";
import { createAndInjectPullTab } from "./dom/pullTab";
import { setupContentScriptEventListeners } from "./events/contentScriptEventListeners";

//contentScript.ts is injected into the web page and intera cts with the DOM to scrape data.

// Remove sentry for MVP, reduce permissions required by extension
// initSentry();
injectExternalScriptToNotifyWhenRightmovePageModelAvailable();
setupContentScriptEventListeners();
createAndInjectPullTab();

console.log("contentScript.ts loaded");
