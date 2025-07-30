/**
 * Shows a notification with the specified title and message.
 * This function uses the Chrome Notifications API to display a notification.
 *
 * @param {string} title - The title of the notification.
 * @param {string} message - The message to display in the notification.
 * @param {string} notificationId - Optional ID for the notification.
 */
export function showNotification(title, message, notificationId) {
  chrome.storage.sync.get(['showNotifications'], function (result) {
    if (result.showNotifications !== false) {
      try {
        chrome.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: '../icons/icon-48x48.png',
          title: title,
          message: message,
        });
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  });
}
