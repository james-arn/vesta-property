(function () {
  if (window.PAGE_MODEL) {
    window.postMessage(
      { type: "pageModelAvailable", pageModel: window.PAGE_MODEL },
      "*"
    );
  }
})();
