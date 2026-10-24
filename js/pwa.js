/* Register the static-only Lungitude service worker. */
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {
        // Installation failure must not interrupt the survey.
    });
}
