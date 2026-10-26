/* Cache only an explicit list of public interface files; never API or Places data. */
const CACHE_NAME = "lungitude-static-v2";
const STATIC_FILES = [
    "./css/lungbot.css",
    "./js/lungbot.js",
    "./js/branding.js",
    "./index.html",
    "./lung.html",
    "./offline.html",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./assets/favicon.svg",
    "./css/app.css",
    "./css/survey.css",
    "./css/lab-page.css",
    "./css/website.css",
    "./css/study-page.css",
    "./css/record-page.css",
    "./css/followup-page.css",
    "./js/lungsound.js",
    "./js/pulse.js",
    "./js/app.js",
    "./js/results.js",
    "./js/record.js",
    "./js/lab.js",
    "./js/breath.js",
    "./js/privacy.js",
    "./js/followup.js",
    "./js/survey.js",
    "./js/pwa.js",
    "./js/study-page.js",
    "./js/hands.js"
];
const STATIC_URLS = new Set(STATIC_FILES.map(function(path) {
    return new URL(path, self.location.href).href;
}));
self.addEventListener("install", function(event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
        return cache.addAll(STATIC_FILES);
    }));
});
self.addEventListener("activate", function(event) {
    event.waitUntil(caches.keys().then(function(names) {
        return Promise.all(names.filter(function(name) {
            return name.startsWith("lungitude-static-") && name !==
            CACHE_NAME;
        }).map(function(name) {
            return caches.delete(name);
        }));
    }));
});
self.addEventListener("fetch", function(event) {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin || !STATIC_URLS.has(url
        .href)) {
        return;
    }
    event.respondWith(fetch(request).then(function(response) {
        if (response.ok && response.type === "basic") {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
                return cache.put(request, copy);
            }));
        }
        return response;
    }).catch(function() {
        return caches.match(request).then(function(response) {
            if (response) {
                return response;
            }
            if (request.mode === "navigate") {
                return caches.match("./offline.html");
            }
            return Response.error();
        });
    }));
});
