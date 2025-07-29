/**
 * Shows a notification with the specified title and message.
 * This function uses the Chrome Notifications API to display a notification.
 *
 * @param {string} title - The title of the notification.
 * @param {string} message - The message to display in the notification.
 */
export function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon-48x48.png',
      title: title,
      message: message,
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}
