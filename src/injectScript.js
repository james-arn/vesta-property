(function () {
  const checkInterval = 200; // Check every 200ms
  const maxAttempts = 50; // Try for up to 10 seconds (50 * 200ms)
  let attempts = 0;
  let intervalId = null;
  let startTime = performance.now();
  console.log(
    `[Vesta Inject Script] Initializing at ${new Date().toISOString()} for URL: ${window.location.href}`
  );

  const cleanup = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log("[Vesta Inject Script] Polling stopped.");
    }
    // Note: This script is no longer removed by the content script on load.
    // It will remain in the DOM unless it removes itself.
    // Example: document.currentScript.remove(); (but be careful with timing if async operations like postMessage are still pending)
  };

  const checkForPageModel = () => {
    attempts++;
    if (window.PAGE_MODEL) {
      const modelFoundTime = performance.now();
      console.log(
        `[Vesta Inject Script] Found window.PAGE_MODEL (attempt ${attempts}) after ${((modelFoundTime - startTime) / 1000).toFixed(2)}s.`
      );
      try {
        // Ensure PAGE_MODEL is not too large or circular if cloning issues arise with postMessage
        // For complex objects, consider sending only necessary parts or a flag.
        window.postMessage({ type: "pageModelAvailable", pageModel: window.PAGE_MODEL }, "*");
        console.log("[Vesta Inject Script] Successfully posted pageModelAvailable.");
      } catch (e) {
        console.error("[Vesta Inject Script] Error posting message (pageModelAvailable):", e);
      }
      cleanup();
    } else if (attempts >= maxAttempts) {
      const timeoutTime = performance.now();
      console.warn(
        `[Vesta Inject Script] Max attempts reached on URL: ${window.location.href}. window.PAGE_MODEL not found after ${attempts} attempts over ${((timeoutTime - startTime) / 1000).toFixed(2)}s.`
      );
      try {
        window.postMessage({ type: "pageModelTimeout", url: window.location.href }, "*");
        console.log("[Vesta Inject Script] Successfully posted pageModelTimeout.");
      } catch (e) {
        console.error("[Vesta Inject Script] Error posting message (pageModelTimeout):", e);
      }
      cleanup();
    } else {
      if (attempts % 5 === 0) {
        console.log(
          `[Vesta Inject Script] window.PAGE_MODEL not found. Attempt: ${attempts}. Elapsed: ${((performance.now() - startTime) / 1000).toFixed(2)}s`
        );
      }
    }
  };

  // Check immediately in case it's already there
  if (window.PAGE_MODEL) {
    const initialFoundTime = performance.now();
    console.log(
      `[Vesta Inject Script] Found window.PAGE_MODEL on initial synchronous check after ${((initialFoundTime - startTime) / 1000).toFixed(2)}s.`
    );
    try {
      window.postMessage({ type: "pageModelAvailable", pageModel: window.PAGE_MODEL }, "*");
      console.log("[Vesta Inject Script] Successfully posted pageModelAvailable (initial check).");
    } catch (e) {
      console.error("[Vesta Inject Script] Error posting message (initial check):", e);
    }
    // No need to call cleanup() here as polling interval won't be set.
  } else {
    console.log(
      `[Vesta Inject Script] window.PAGE_MODEL not found on initial check (${((performance.now() - startTime) / 1000).toFixed(2)}s). Starting polling.`
    );
    intervalId = setInterval(checkForPageModel, checkInterval);
  }
})();
