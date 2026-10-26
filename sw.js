/* Cache only an explicit list of public interface files; never API or Places data. */
const CACHE_NAME = "lungitude-static-dark-v3";
const STATIC_FILES = [
    "./index.html",
    "./pulse-check.html",
    "./breast.html",
    "./evidence.html",
    "./css/skin.css",
    "./js/skin.js",
    "./js/account.js",
    "./js/care.js",
    "./js/engagement.js",
    "./js/capture-quality.js",
    "./js/breast.js",
    "./js/pulse-measure.js",
    "./js/pulse-manual.js",
    "./js/neck-ppg.js",
    "./js/neck-ppg-core.js",
    "./js/pwa.js",
    "./js/evidence-page-1.js",
    "./offline.html",
    "./manifest.webmanifest",
    "./assets/favicon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];
const STATIC_URLS = new Set(STATIC_FILES.map(function(path) {
    return new URL(path, self.location.href).href;
}));
self.addEventListener("install", function(event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
        return cache.addAll(STATIC_FILES).then(function() {
            return self.skipWaiting();
        });
    }));
});
self.addEventListener("activate", function(event) {
    event.waitUntil(caches.keys().then(function(names) {
        return Promise.all(names.filter(function(name) {
            return name.startsWith("lungitude-static-") && name !==
            CACHE_NAME;
        }).map(function(name) {
            return caches.delete(name);
        })).then(function() {
            return self.clients.claim();
        });
    }));
});
self.addEventListener("fetch", function(event) {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin || !STATIC_URLS.has(url.origin + url.pathname)) {
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
