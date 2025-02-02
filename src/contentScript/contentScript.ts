import { injectExternalScriptToNotifyWhenRightmovePageModelAvailable } from "./dom/injectScriptHandler";
import { setupContentScriptEventListeners } from "./events/contentScriptEventListeners";

//contentScript.ts is injected into the web page and intera cts with the DOM to scrape data.

injectExternalScriptToNotifyWhenRightmovePageModelAvailable();
setupContentScriptEventListeners();

console.log("contentScript.ts loaded");
