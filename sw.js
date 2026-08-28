const CACHE_NAME = "study-planner-v2";
const APP_FILES = [
    "/",
    "/index.html",
    "/login.html",
    "/register.html",
    "/forgot-password.html",
    "/dashboard.html",
    "/dashboard.css",
    "/styless.css",
    "/scripts.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    // Never cache API/database requests
    if (url.pathname.startsWith("/api/")) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
