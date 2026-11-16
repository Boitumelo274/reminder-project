var V = "remindr-v1",
  ASSETS = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "manifest.webmanifest",
    "icon-192.png",
    "icon-512.png",
  ];
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(V)
      .then(function (c) {
        return c.addAll(ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (k) {
        return Promise.all(
          k
            .filter(function (x) {
              return x !== V;
            })
            .map(function (x) {
              return caches.delete(x);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});
self.addEventListener("fetch", function (e) {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then(function (r) {
        if (r.ok) {
          var c = r.clone();
          caches.open(V).then(function (ch) {
            ch.put(e.request, c);
          });
        }
        return r;
      })
      .catch(function () {
        return caches.match(e.request).then(function (m) {
          return m || caches.match("index.html");
        });
      }),
  );
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (l) {
        for (var i = 0; i < l.length; i++) {
          if ("focus" in l[i]) {
            l[i].postMessage({ type: "focus-reminder" });
            return l[i].focus();
          }
        }
        return self.clients.openWindow("./");
      }),
  );
});
function getItems() {
  return new Promise(function (res) {
    try {
      var r = indexedDB.open("remindr", 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore("kv");
      };
      r.onsuccess = function () {
        try {
          var q = r.result.transaction("kv").objectStore("kv").get("items");
          q.onsuccess = function () {
            res(q.result || []);
          };
          q.onerror = function () {
            res([]);
          };
        } catch (e) {
          res([]);
        }
      };
      r.onerror = function () {
        res([]);
      };
    } catch (e) {
      res([]);
    }
  });
}
self.addEventListener("periodicsync", function (e) {
  if (e.tag !== "remindr-check") return;
  e.waitUntil(
    getItems().then(function (items) {
      var now = Date.now();
      return Promise.all(
        items
          .filter(function (i) {
            return !i.finished && i.due <= now;
          })
          .map(function (i) {
            return self.registration.showNotification(i.title, {
              body: i.note || "It’s time.",
              tag: i.id + ":" + i.due,
              icon: "icon-192.png",
              badge: "icon-192.png",
              data: { id: i.id },
            });
          }),
      );
    }),
  );
});
