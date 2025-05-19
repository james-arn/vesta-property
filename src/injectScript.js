(function () {
  const CHECK_INTERVAL_MS = 250;
  const MAX_ATTEMPTS = 40; // ~10 seconds

  let checkAttempts = 0;
  let checkIntervalId = null;
  let lastFoundModelId = null;
  let checkStartTime = 0;
  let observer = null; // MutationObserver instance

  const cleanupCheckInterval = () => {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
  };

  // --- Core Logic --- Function to check for PAGE_MODEL ---
  const checkForPageModel = () => {
    checkAttempts++;
    const currentPageModel = window.PAGE_MODEL;

    if (currentPageModel && currentPageModel.propertyData?.id) {
      if (currentPageModel.propertyData.id !== lastFoundModelId) {
        try {
          window.postMessage({ type: "pageModelAvailable", pageModel: currentPageModel }, "*");
          lastFoundModelId = currentPageModel.propertyData.id;
        } catch (e) {
          console.error("[Vesta Inject Script] Error posting message (pageModelAvailable):", e);
          lastFoundModelId = null;
        }
        cleanupCheckInterval();
      } else {
        cleanupCheckInterval();
      }
    } else if (checkAttempts >= MAX_ATTEMPTS) {
      const timeoutTime = performance.now();
      console.warn(
        `[Vesta Inject Script] Max attempts reached for URL: ${window.location.href}. window.PAGE_MODEL not found after ${checkAttempts} attempts over ${((timeoutTime - checkStartTime) / 1000).toFixed(2)}s.`
      );
      try {
        // Only send timeout if we haven't found *any* model for this ID check cycle
        if (lastFoundModelId !== window.PAGE_MODEL?.propertyData?.id) {
          window.postMessage({ type: "pageModelTimeout", url: window.location.href }, "*");
        }
      } catch (e) {
        console.error("[Vesta Inject Script] Error posting message (pageModelTimeout):", e);
      }
      cleanupCheckInterval();
    }
  };

  // --- Trigger Function --- Starts the check process ---
  const startCheckingForPageModel = () => {
    // Avoid starting check if one is already running for the same model ID attempt
    if (checkIntervalId) {
      return;
    }

    cleanupCheckInterval();
    checkAttempts = 0;
    checkStartTime = performance.now();
    // Check immediately
    const initialModel = window.PAGE_MODEL;
    if (
      initialModel &&
      initialModel.propertyData?.id &&
      initialModel.propertyData.id !== lastFoundModelId
    ) {
      const initialFoundTime = performance.now();
      console.log(
        `[Vesta Inject Script] Found NEW window.PAGE_MODEL (id: ${initialModel.propertyData.id}) on initial check after ${((initialFoundTime - checkStartTime) / 1000).toFixed(2)}s.`
      );
      try {
        window.postMessage({ type: "pageModelAvailable", pageModel: initialModel }, "*");
        console.log(
          "[Vesta Inject Script] Successfully posted pageModelAvailable (initial check)."
        );
        lastFoundModelId = initialModel.propertyData.id;
      } catch (e) {
        console.error("[Vesta Inject Script] Error posting message (initial check):", e);
        lastFoundModelId = null;
      }
      // Don't start interval if found immediately
    } else {
      checkIntervalId = setInterval(checkForPageModel, CHECK_INTERVAL_MS);
    }
  };

  // --- MutationObserver Callback --- Reacts to DOM changes ---
  const handleMutation = (mutationsList, observer) => {
    // We don't need to inspect mutationsList in detail for this strategy.
    // Any significant DOM change might indicate navigation.

    // Check if the URL looks like a property page AFTER the mutation
    if (window.location.href.includes("/properties/")) {
      startCheckingForPageModel();
    } else {
      // Navigated away from a property page
      cleanupCheckInterval();
      lastFoundModelId = null;
    }
  };

  // --- Initialization ---
  // Initial check for the first page load
  if (window.location.href.includes("/properties/")) {
    startCheckingForPageModel();
  }

  // Setup and start the MutationObserver
  observer = new MutationObserver(handleMutation);
  const config = { childList: true, subtree: true };

  // Start observing the body for configured mutations
  // We might need a slight delay for the initial body content to be there reliably
  setTimeout(() => {
    if (document.body) {
      observer.observe(document.body, config);
    }
  }, 100); // 100ms delay before starting observer
})();
