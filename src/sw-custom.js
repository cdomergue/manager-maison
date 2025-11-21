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
      const notificationData = event.data.payload;

      // Afficher la notification
      self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        requireInteraction: notificationData.requireInteraction,
        data: notificationData,
        actions: [
          {
            action: "open",
            title: "Ouvrir",
            icon: notificationData.icon,
          },
          {
            action: "close",
            title: "Fermer",
          },
        ],
      });
    }
  });

  // Gérer les clics sur les notifications
  self.addEventListener("notificationclick", function (event) {
    const notification = event.notification;
    const action = event.action;

    if (action === "close") {
      notification.close();
      return;
    }

    // Ouvrir l'application quand on clique sur la notification
    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(function (clientList) {
          // Si l'application est déjà ouverte, la mettre au premier plan
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.indexOf("/") !== -1 && "focus" in client) {
              notification.close();
              return client.focus();
            }
          }

          // Sinon, ouvrir une nouvelle fenêtre
          if (clients.openWindow) {
            notification.close();
            return clients.openWindow("/");
          }
        }),
    );
  });

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
