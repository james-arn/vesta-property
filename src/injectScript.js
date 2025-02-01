(function () {
  if (window.PAGE_MODEL) {
    window.postMessage(
      { type: "PAGE_MODEL_AVAILABLE", pageModel: window.PAGE_MODEL },
      "*"
    );
  }
})();
