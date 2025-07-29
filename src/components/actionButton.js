/**
 * Sets the badge text for the extension action icon.
 * This sets the badge globally (for new tabs) and for all currently open tabs.
 * If a tab does not allow badge setting, it will be skipped with a warning.
 *
 * @async
 * @param {string} text - The text to display on the badge.
 * @returns {Promise<void>}
 */
export async function setBadge(text) {
  try {
    // Set badge globally (for new tabs)
    chrome.action.setBadgeText({ text: text });

    // Get all tabs and set badge for each
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        chrome.action.setBadgeText({ text: text, tabId: tab.id });
      } catch (tabError) {
        // Some tabs might not allow badge setting, continue with others
        console.warn(`Could not set badge for tab ${tab.id}:`, tabError);
      }
    }
  } catch (error) {
    console.error('Error setting badge:', error);
  }
}

/**
 * Clears the badge text for the extension action icon.
 * This removes the badge globally (for new tabs) and for all currently open tabs.
 * If a tab does not allow badge clearing, it will be skipped with a warning.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function clearBadge() {
  try {
    // Clear badge globally (for new tabs)
    chrome.action.setBadgeText({ text: '' });

    // Get all tabs and clear badge for each
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      } catch (tabError) {
        // Some tabs might not allow badge clearing, continue with others
        console.warn(`Could not clear badge for tab ${tab.id}:`, tabError);
      }
    }
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
}
