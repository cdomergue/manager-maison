// Service Worker personnalisé pour les notifications
// Ce service worker étend le service worker Angular pour ajouter la gestion des notifications

(function () {
  "use strict";

  // Fonction pour envoyer des logs aux clients
  function broadcastLog(message, details) {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "DEBUG_LOG",
          message: message,
          details: details,
        });
      });
    });
  }

  // Écouter les messages du thread principal
  self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SHOW_NOTIFICATION") {
      // ... existing code ...
    }
  });

  // ... existing code ...

  // Gérer les notifications push reçues du serveur
  self.addEventListener("push", function (event) {
    if (event.data) {
      const text = event.data.text();
      console.log("[SW] Push event received", text);
      broadcastLog("Push event received", text);

      let data;
      try {
        data = event.data.json();
      } catch (e) {
        broadcastLog("Error parsing push data", e.message);
        return;
      }

      const options = {
        body: data.body,
        icon: data.icon || "/icons/android/android-launchericon-192-192.png",
        badge: data.badge || "/icons/android/android-launchericon-72-72.png",
        tag: data.tag,
        requireInteraction: data.requireInteraction || false,
        data: data,
        actions: [
          {
            action: "open",
            title: "Ouvrir",
            icon: data.icon || "/icons/android/android-launchericon-192-192.png",
          },
          {
            action: "close",
            title: "Fermer",
          },
        ],
      };

      const promise = self.registration
        .showNotification(data.title, options)
        .then(() => broadcastLog("Notification shown", data.title))
        .catch((err) => broadcastLog("Error showing notification", err.message));

      event.waitUntil(promise);
    } else {
      broadcastLog("Push event received but no data");
    }
  });
})();
