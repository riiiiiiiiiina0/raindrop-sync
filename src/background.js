console.log('Raindrop Sync background service worker started');

// Global state for backup process
let isBackupProcessing = false;
let backupTimeoutId = null;
let currentBackupStartTime = null;

// Restore backup state from storage on startup
async function restoreBackupState() {
  try {
    // First, clean up any stale polling alarms from previous sessions
    await cleanupStaleAlarms();

    const result = await chrome.storage.local.get([
      'backupProcessing',
      'backupStartTime',
      'backupToken',
    ]);
    if (
      result.backupProcessing &&
      result.backupStartTime &&
      result.backupToken
    ) {
      isBackupProcessing = true;
      currentBackupStartTime = result.backupStartTime;

      console.log(
        'Restored backup state from storage - resuming backup process',
      );

      // Check if the backup has been running too long (over 30 minutes)
      const timeElapsed = Date.now() - currentBackupStartTime;
      if (timeElapsed > 30 * 60 * 1000) {
        console.log('Backup process has been running too long, cleaning up');
        cleanupBackupProcess();
        return;
      }

      // Set badge to show backup is in progress
      setBadge('⏳');
      sendStatusUpdate('Resuming backup process...', 'info', 'polling');

      // Create timeout for remaining time
      const remainingTime = 30 * 60 * 1000 - timeElapsed;
      backupTimeoutId = setTimeout(() => {
        cleanupBackupProcess();
        sendStatusUpdate('Backup process timed out after 30 minutes', 'error');
        showNotification(
          'Backup Failed',
          'The backup process timed out after 30 minutes.',
        );
      }, remainingTime);

      // Resume polling by setting up the alarm
      setupPollingAlarm();
    }
  } catch (error) {
    console.error('Error restoring backup state:', error);
  }
}

// Save backup state to storage
async function saveBackupState(token) {
  try {
    await chrome.storage.local.set({
      backupProcessing: isBackupProcessing,
      backupStartTime: currentBackupStartTime,
      backupToken: token,
    });
  } catch (error) {
    console.error('Error saving backup state:', error);
  }
}

// Clear backup state from storage
async function clearBackupState() {
  try {
    await chrome.storage.local.remove([
      'backupProcessing',
      'backupStartTime',
      'backupToken',
    ]);
  } catch (error) {
    console.error('Error clearing backup state:', error);
  }
}

// Setup polling alarm instead of setInterval
function setupPollingAlarm() {
  chrome.alarms.create('backupPolling', {
    delayInMinutes: 1, // Check in 1 minute
    periodInMinutes: 1, // Check every minute
  });
}

// Clear polling alarm
function clearPollingAlarm() {
  chrome.alarms.clear('backupPolling');
}

// Clean up stale alarms from previous sessions
async function cleanupStaleAlarms() {
  try {
    // Clear any existing polling alarms that might be left from previous sessions
    await chrome.alarms.clear('backupPolling');
    console.log('Cleaned up stale polling alarms');
  } catch (error) {
    console.error('Error cleaning up stale alarms:', error);
  }
}

// Badge management functions
async function setBadge(text) {
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

async function clearBadge() {
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

// Notification function
function showNotification(title, message) {
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

// Send status updates to options page (if it's open)
function sendStatusUpdate(status, type, step) {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: status,
      type: type,
      step: step || null,
      isProcessing: isBackupProcessing,
    });
  } catch (error) {
    // Options page might not be open, that's fine
    console.log(
      'Could not send status update (options page may be closed):',
      error,
    );
  }
}

// Parse Raindrop backup HTML and extract bookmark structure
function parseRaindropBackup(htmlContent) {
  try {
    // Parse the HTML content using text-based parsing since DOMParser is not available in service workers
    const parsedStructure = parseNetscapeBookmarks(htmlContent);

    console.log('Parsed bookmark structure:', parsedStructure);
    return parsedStructure;
  } catch (error) {
    console.error('Error parsing backup HTML:', error);
    throw error;
  }
}

// Parse Netscape bookmark format using text parsing
function parseNetscapeBookmarks(htmlContent) {
  const lines = htmlContent.split('\n');
  const result = [];
  const folderStack = [{ children: result, level: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for folder start (H3 tag)
    const folderMatch = line.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      const folderTitle = decodeHtmlEntities(folderMatch[1]);

      // Extract attributes from H3 tag
      const addDateMatch = line.match(/ADD_DATE="(\d+)"/i);
      const lastModifiedMatch = line.match(/LAST_MODIFIED="(\d+)"/i);

      const folder = {
        type: 'folder',
        title: folderTitle,
        addDate: addDateMatch ? parseInt(addDateMatch[1]) * 1000 : Date.now(),
        lastModified: lastModifiedMatch
          ? parseInt(lastModifiedMatch[1]) * 1000
          : Date.now(),
        children: [],
      };

      // Add to current parent
      const currentParent = folderStack[folderStack.length - 1];
      currentParent.children.push(folder);

      // Push this folder to stack for future children
      folderStack.push({
        children: folder.children,
        level: getCurrentLevel(line),
      });
      continue;
    }

    // Check for bookmark (A tag)
    const bookmarkMatch = line.match(/<A[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const url = decodeHtmlEntities(bookmarkMatch[1]);
      const title = decodeHtmlEntities(bookmarkMatch[2]);

      // Extract attributes
      const addDateMatch = line.match(/ADD_DATE="(\d+)"/i);
      const lastModifiedMatch = line.match(/LAST_MODIFIED="(\d+)"/i);
      const tagsMatch = line.match(/TAGS="([^"]*)"/i);
      const coverMatch = line.match(/DATA-COVER="([^"]*)"/i);
      const importantMatch = line.match(/DATA-IMPORTANT="([^"]*)"/i);

      // Check for description in next line (DD tag)
      let description = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const descMatch = nextLine.match(/<DD>(.*?)$/i);
        if (descMatch) {
          description = decodeHtmlEntities(descMatch[1]);
        }
      }

      const bookmark = {
        type: 'bookmark',
        title: title,
        url: url,
        addDate: addDateMatch ? parseInt(addDateMatch[1]) * 1000 : Date.now(),
        lastModified: lastModifiedMatch
          ? parseInt(lastModifiedMatch[1]) * 1000
          : Date.now(),
        tags: tagsMatch ? tagsMatch[1] : '',
        description: description,
        cover: coverMatch ? coverMatch[1] : '',
        important: importantMatch ? importantMatch[1] === 'true' : false,
      };

      // Add to current parent
      const currentParent = folderStack[folderStack.length - 1];
      currentParent.children.push(bookmark);
      continue;
    }

    // Check for end of folder (</DL>)
    if (line.match(/<\/DL>/i)) {
      // Pop folder from stack if we're not at root level
      if (folderStack.length > 1) {
        folderStack.pop();
      }
    }
  }

  return result;
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    return entities[match] || match;
  });
}

// Helper function to determine nesting level (not used in current implementation but kept for future use)
function getCurrentLevel(line) {
  const leadingSpaces = line.match(/^(\s*)/);
  return leadingSpaces ? Math.floor(leadingSpaces[1].length / 2) : 0;
}

// Delete existing "Raindrop" folder from browser bookmarks
async function deleteExistingRaindropFolder() {
  try {
    // Search for existing Raindrop folder
    const searchResults = await chrome.bookmarks.search({ title: 'Raindrop' });

    for (const bookmark of searchResults) {
      // Check if this is a folder (no URL means it's a folder)
      if (!bookmark.url) {
        console.log(`Deleting existing Raindrop folder: ${bookmark.id}`);
        await chrome.bookmarks.removeTree(bookmark.id);
      }
    }
  } catch (error) {
    console.error('Error deleting existing Raindrop folder:', error);
    throw error;
  }
}

// Create bookmarks from parsed structure
async function createBookmarksFromStructure(parentId, bookmarkStructure) {
  for (const item of bookmarkStructure) {
    try {
      if (item.type === 'folder') {
        // Create folder
        const folder = await chrome.bookmarks.create({
          parentId: parentId,
          title: item.title,
        });

        console.log(`Created folder: ${item.title}`);

        // Recursively create children
        if (item.children && item.children.length > 0) {
          await createBookmarksFromStructure(folder.id, item.children);
        }
      } else if (item.type === 'bookmark') {
        // Create bookmark
        if (item.url) {
          await chrome.bookmarks.create({
            parentId: parentId,
            title: item.title,
            url: item.url,
          });

          console.log(`Created bookmark: ${item.title} -> ${item.url}`);
        }
      }
    } catch (error) {
      console.error(`Error creating ${item.type}: ${item.title}`, error);
      // Continue with other items even if one fails
    }
  }
}

// Main function to sync Raindrop backup with browser bookmarks
async function syncRaindropBookmarks(htmlContent) {
  try {
    sendStatusUpdate('Parsing backup content...', 'info', 'parsing');

    // Parse the backup HTML
    const bookmarkStructure = parseRaindropBackup(htmlContent);

    sendStatusUpdate(
      'Deleting existing Raindrop folder...',
      'info',
      'deleting',
    );

    // Delete existing Raindrop folder
    await deleteExistingRaindropFolder();

    sendStatusUpdate('Creating new Raindrop folder...', 'info', 'creating');

    // Create new Raindrop folder in bookmarks bar
    const bookmarksBar = await chrome.bookmarks.getTree();
    let parentId = '1'; // Default to bookmarks bar

    if (bookmarksBar && bookmarksBar[0] && bookmarksBar[0].children) {
      const bookmarksBarNode = bookmarksBar[0].children.find(
        (node) => node.id === '1',
      );
      if (bookmarksBarNode) {
        parentId = bookmarksBarNode.id;
      }
    }

    const raindropFolder = await chrome.bookmarks.create({
      parentId: parentId,
      title: 'Raindrop',
    });

    sendStatusUpdate('Importing bookmarks...', 'info', 'importing');

    // Import all bookmarks into the new folder
    await createBookmarksFromStructure(raindropFolder.id, bookmarkStructure);

    // Save the bookmark import timestamp
    await chrome.storage.sync.set({
      lastImportTime: Date.now(),
    });

    console.log('Successfully synced Raindrop bookmarks to browser');
    return true;
  } catch (error) {
    console.error('Error syncing Raindrop bookmarks:', error);
    sendStatusUpdate(`Failed to sync bookmarks: ${error.message}`, 'error');
    showNotification(
      'Raindrop Sync Failed',
      `Failed to import bookmarks to browser: ${error.message}`,
    );
    return false;
  }
}

// Backup creation function
async function createBackup(token) {
  try {
    const response = await fetch('https://api.raindrop.io/rest/v1/backup', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.text();
      console.log('Backup creation response:', result);
      return true;
    } else {
      throw new Error(
        `Failed to create backup: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    sendStatusUpdate(`Failed to create backup: ${error.message}`, 'error');
    return false;
  }
}

// Check for recent backup (within 1 hour)
async function checkForRecentBackup(token) {
  try {
    const response = await fetch('https://api.raindrop.io/rest/v1/backups', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000; // 1 hour instead of 30 minutes

      // Find the most recent backup within the last 1 hour
      const recentBackup = data.items.find((backup) => {
        const backupTime = new Date(backup.created).getTime();
        return backupTime > oneHourAgo;
      });

      if (recentBackup) {
        console.log('Recent backup found:', recentBackup);
        return recentBackup;
      }

      console.log('No backup found within the last 1 hour');
      return null;
    } else {
      throw new Error(
        `Failed to get backups: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error checking for recent backup:', error);
    throw error;
  }
}

// Check for new backup after start time
async function checkForNewBackup(token, startTime) {
  try {
    const response = await fetch('https://api.raindrop.io/rest/v1/backups', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();

      // Find backup created after we started the process
      const newBackup = data.items.find((backup) => {
        const backupTime = new Date(backup.created).getTime();
        return backupTime > startTime;
      });

      if (newBackup) {
        console.log('New backup found:', newBackup);
        return newBackup;
      }

      console.log('No new backup found yet, continuing to poll...');
      return null;
    } else {
      throw new Error(
        `Failed to get backups: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error checking for new backup:', error);
    throw error;
  }
}

// Download backup function
async function downloadBackup(token, backup) {
  try {
    const backupId = backup._id;
    console.log(`Attempting to download backup: ${backupId}`);

    const response = await fetch(
      `https://api.raindrop.io/rest/v1/backup/${backupId}.html`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const htmlContent = await response.text();

      // Print HTML content in console
      console.log('=== RAINDROP BACKUP HTML CONTENT ===');
      console.log(htmlContent);
      console.log('=== END OF BACKUP CONTENT ===');

      // Save the backup creation timestamp (actual creation time from Raindrop)
      const backupCreationTime = new Date(backup.created).getTime();
      await chrome.storage.sync.set({
        lastBackupTime: backupCreationTime,
      });

      // Sync the downloaded backup with browser bookmarks
      const syncSuccess = await syncRaindropBookmarks(htmlContent);
      if (syncSuccess) {
        // Get the actual import time that was saved during sync
        const result = await chrome.storage.sync.get(['lastImportTime']);
        const actualImportTime = result.lastImportTime || Date.now();

        // Send a specific message to refresh timestamps immediately
        try {
          chrome.runtime.sendMessage({
            action: 'refreshTimestamps',
            lastBackupTime: backupCreationTime,
            lastImportTime: actualImportTime,
          });
        } catch (error) {
          console.log('Could not send refresh timestamps message:', error);
        }
      }

      return syncSuccess;
    } else {
      throw new Error(
        `Failed to download backup: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error downloading backup:', error);
    sendStatusUpdate(`Failed to download backup: ${error.message}`, 'error');
    cleanupBackupProcess();
    return false;
  }
}

// Cleanup backup process
function cleanupBackupProcess() {
  isBackupProcessing = false;
  currentBackupStartTime = null;

  // Clear timeouts and intervals
  if (backupTimeoutId) {
    clearTimeout(backupTimeoutId);
    backupTimeoutId = null;
  }

  // Clear polling alarm
  clearPollingAlarm();

  // Reset badge
  clearBadge();

  // Clear local storage state
  clearBackupState();

  // Send cleanup notification to options page
  sendStatusUpdate('Process cleanup completed', 'info', 'cleanup');
}

// Main backup process function
async function startBackupProcess(token) {
  // Prevent multiple concurrent backup processes
  if (isBackupProcessing) {
    sendStatusUpdate('Backup is already in progress. Please wait...', 'info');
    return { success: false, message: 'Already in progress' };
  }

  if (!token) {
    sendStatusUpdate('No API token provided', 'error');
    return { success: false, message: 'No token provided' };
  }

  try {
    isBackupProcessing = true;
    currentBackupStartTime = Date.now();

    // Save backup state to storage
    await saveBackupState(token);

    // Step 1: Show loading badge and status
    setBadge('⏳');
    sendStatusUpdate(
      'Checking for existing backup within 1 hour...',
      'info',
      'checking',
    );

    // Set 30-minute timeout
    const timeout = 30;
    backupTimeoutId = setTimeout(() => {
      cleanupBackupProcess();
      sendStatusUpdate(
        `Backup process timed out after ${timeout} minutes`,
        'error',
      );
      showNotification(
        'Backup Failed',
        `The backup process timed out after ${timeout} minutes.`,
      );
    }, timeout * 60 * 1000);

    // Step 2: Check for recent backup (within 1 hour)
    const recentBackup = await checkForRecentBackup(token);

    if (recentBackup) {
      // Recent backup found, download directly
      const backupAge = Math.round(
        (Date.now() - new Date(recentBackup.created).getTime()) / (1000 * 60),
      );
      sendStatusUpdate(
        `Recent backup found (${backupAge} minutes old)! Downloading...`,
        'info',
        'downloading',
      );

      const success = await downloadBackup(token, recentBackup);
      if (success) {
        cleanupBackupProcess();
        sendStatusUpdate(
          'Recent backup downloaded successfully!',
          'success',
          'completed',
        );
        showNotification(
          'Raindrop Sync Complete',
          'Your recent Raindrop.io backup has been downloaded and imported to browser bookmarks successfully.',
        );
        return { success: true, message: 'Recent backup downloaded' };
      }
      cleanupBackupProcess();
      return { success: false, message: 'Failed to download recent backup' };
    }

    // Step 3: No recent backup found, create new one
    sendStatusUpdate(
      'No recent backup found within 1 hour. Creating new backup...',
      'info',
      'creating',
    );

    const backupCreated = await createBackup(token);
    if (!backupCreated) {
      cleanupBackupProcess();
      return { success: false, message: 'Failed to create backup' };
    }

    // Step 4: Start polling for backup completion
    sendStatusUpdate(
      'Backup creation initiated. Checking for completion...',
      'info',
      'polling',
    );

    // Set up polling alarm
    setupPollingAlarm();

    return { success: true, message: 'Backup process started' };
  } catch (error) {
    console.error('Backup process error:', error);
    cleanupBackupProcess();
    sendStatusUpdate(`Backup failed: ${error.message}`, 'error');
    showNotification(
      'Raindrop Sync Failed',
      `Backup process failed: ${error.message}`,
    );
    return { success: false, message: error.message };
  }
}

function startBackup(callback) {
  // Get token from storage and start backup
  chrome.storage.sync.get(['raindropToken'], async (result) => {
    const token = result.raindropToken;
    const response = await startBackupProcess(token);
    callback?.(response);
  });
}

// Handle backup polling alarm
async function handleBackupPolling() {
  try {
    // Get backup state from storage
    const result = await chrome.storage.local.get([
      'backupProcessing',
      'backupStartTime',
      'backupToken',
    ]);

    if (
      !result.backupProcessing ||
      !result.backupStartTime ||
      !result.backupToken
    ) {
      console.log('No backup in progress, clearing polling alarm');
      clearPollingAlarm();
      return;
    }

    const token = result.backupToken;
    const startTime = result.backupStartTime;

    console.log('Checking for new backup completion...');

    const newBackup = await checkForNewBackup(token, startTime);
    if (newBackup) {
      // Stop polling and download the backup
      clearPollingAlarm();
      sendStatusUpdate(
        'New backup found! Downloading...',
        'info',
        'downloading',
      );

      const success = await downloadBackup(token, newBackup);
      if (success) {
        // Complete the process
        cleanupBackupProcess();
        sendStatusUpdate(
          'Backup created and downloaded successfully!',
          'success',
          'completed',
        );
        showNotification(
          'Raindrop Sync Complete',
          'Your Raindrop.io backup has been downloaded and imported to browser bookmarks successfully.',
        );
      }
    }
  } catch (error) {
    console.error('Error during backup polling:', error);
    clearPollingAlarm();
    cleanupBackupProcess();
    sendStatusUpdate(`Error checking backup status: ${error.message}`, 'error');
  }
}

// Auto backup management
async function setupAutoBackup(
  enabled,
  frequency = 'daily',
  preserveScheduled = true,
) {
  if (enabled) {
    // Check if we should preserve an existing scheduled time
    if (preserveScheduled) {
      const storedResult = await chrome.storage.sync.get([
        'nextAutoBackupTime',
      ]);
      const existingAlarm = await chrome.alarms.get('autoBackup');

      if (
        storedResult.nextAutoBackupTime &&
        storedResult.nextAutoBackupTime > Date.now()
      ) {
        // We have a valid future backup time stored, use it
        const delayInMinutes = Math.max(
          1,
          Math.ceil((storedResult.nextAutoBackupTime - Date.now()) / 60000),
        );

        // Calculate period based on frequency for future alarms
        let periodInMinutes;
        switch (frequency) {
          case '10min':
            periodInMinutes = 10;
            break;
          case 'hourly':
            periodInMinutes = 60;
            break;
          case 'weekly':
            periodInMinutes = 7 * 24 * 60;
            break;
          case 'daily':
          default:
            periodInMinutes = 24 * 60;
            break;
        }

        chrome.alarms.create('autoBackup', {
          delayInMinutes: delayInMinutes,
          periodInMinutes: periodInMinutes,
        });
        console.log(
          `Auto backup alarm restored - next backup at ${new Date(
            storedResult.nextAutoBackupTime,
          ).toLocaleString()}`,
        );
        return;
      }
    }

    // Calculate delay and period based on frequency for new schedule
    let delayInMinutes, periodInMinutes;

    switch (frequency) {
      case '10min':
        delayInMinutes = 10; // Start in 10 minutes
        periodInMinutes = 10; // Repeat every 10 minutes
        break;
      case 'hourly':
        delayInMinutes = 60; // Start in 1 hour
        periodInMinutes = 60; // Repeat every hour
        break;
      case 'weekly':
        delayInMinutes = 7 * 24 * 60; // Start in 1 week
        periodInMinutes = 7 * 24 * 60; // Repeat every week
        break;
      case 'daily':
      default:
        delayInMinutes = 24 * 60; // Start in 1 day
        periodInMinutes = 24 * 60; // Repeat every day
        break;
    }

    // Create alarm with calculated intervals
    chrome.alarms.create('autoBackup', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: periodInMinutes,
    });

    // Store the scheduled time for persistence across restarts
    const nextBackupTime = Date.now() + delayInMinutes * 60 * 1000;
    await chrome.storage.sync.set({ nextAutoBackupTime: nextBackupTime });

    console.log(
      `Auto backup alarm created - will trigger ${frequency} at ${new Date(
        nextBackupTime,
      ).toLocaleString()}`,
    );
  } else {
    // Clear the alarm and stored time
    chrome.alarms.clear('autoBackup');
    chrome.storage.sync.remove(['nextAutoBackupTime']);
    console.log('Auto backup alarm cleared');
  }
}

// Get next backup time
async function getNextBackupTime(callback) {
  try {
    // Check if auto backup is enabled
    const result = await chrome.storage.sync.get([
      'autoBackupEnabled',
      'nextAutoBackupTime',
    ]);
    if (!result.autoBackupEnabled) {
      callback({ success: false, message: 'Auto backup is disabled' });
      return;
    }

    // First try to get the stored next backup time
    if (result.nextAutoBackupTime && result.nextAutoBackupTime > Date.now()) {
      callback({
        success: true,
        nextBackupTime: result.nextAutoBackupTime,
      });
      return;
    }

    // Fall back to alarm information if stored time is not available or expired
    const alarm = await chrome.alarms.get('autoBackup');
    if (alarm && alarm.scheduledTime) {
      // Update stored time with alarm time for consistency
      await chrome.storage.sync.set({
        nextAutoBackupTime: alarm.scheduledTime,
      });
      callback({
        success: true,
        nextBackupTime: alarm.scheduledTime,
      });
    } else {
      callback({ success: false, message: 'No backup alarm scheduled' });
    }
  } catch (error) {
    console.error('Error getting next backup time:', error);
    callback({ success: false, message: error.message });
  }
}

// Initialize auto backup on extension startup
async function initializeAutoBackup() {
  try {
    const result = await chrome.storage.sync.get([
      'autoBackupEnabled',
      'backupFrequency',
    ]);
    if (result.autoBackupEnabled) {
      const frequency = result.backupFrequency || 'daily';
      setupAutoBackup(true, frequency);
      console.log(
        `Auto backup initialized on startup with frequency: ${frequency}`,
      );
    }
  } catch (error) {
    console.error('Error initializing auto backup:', error);
  }
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoBackup') {
    console.log('Auto backup alarm triggered');

    // Update the stored next backup time for the next occurrence
    try {
      const result = await chrome.storage.sync.get(['backupFrequency']);
      const frequency = result.backupFrequency || 'daily';

      let nextIntervalMs;
      switch (frequency) {
        case '10min':
          nextIntervalMs = 10 * 60 * 1000; // 10 minutes
          break;
        case 'hourly':
          nextIntervalMs = 60 * 60 * 1000; // 1 hour
          break;
        case 'weekly':
          nextIntervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
          break;
        case 'daily':
        default:
          nextIntervalMs = 24 * 60 * 60 * 1000; // 1 day
          break;
      }

      const nextBackupTime = Date.now() + nextIntervalMs;
      await chrome.storage.sync.set({ nextAutoBackupTime: nextBackupTime });
      console.log(
        `Next auto backup scheduled for: ${new Date(
          nextBackupTime,
        ).toLocaleString()}`,
      );
    } catch (error) {
      console.error('Error updating next backup time:', error);
    }

    // Check if we're not already processing a backup
    if (!isBackupProcessing) {
      startBackup((response) => {
        if (response.success) {
          console.log('Auto backup completed successfully');
        } else {
          console.error('Auto backup failed:', response.message);
        }
      });
    } else {
      console.log('Auto backup skipped - backup already in progress');
    }
  } else if (alarm.name === 'backupPolling') {
    console.log('Backup polling alarm triggered');

    // Only proceed if we have a backup in progress
    if (isBackupProcessing && currentBackupStartTime) {
      handleBackupPolling();
    } else {
      // No backup in progress, clear the polling alarm
      clearPollingAlarm();
    }
  }
});

// Message listener for communication with options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startBackup') {
    startBackup(sendResponse);
    return true; // Will respond asynchronously
  }

  if (request.action === 'getBackupStatus') {
    sendResponse({
      isProcessing: isBackupProcessing,
      startTime: currentBackupStartTime,
    });
    return true;
  }

  if (request.action === 'cancelBackup') {
    if (isBackupProcessing) {
      cleanupBackupProcess();
      sendStatusUpdate('Backup process cancelled by user', 'info');
      sendResponse({ success: true, message: 'Backup cancelled' });
    } else {
      sendResponse({ success: false, message: 'No backup in progress' });
    }
    return true;
  }

  if (request.action === 'updateAutoBackup') {
    const frequency = request.frequency || 'daily';
    // When user updates settings, create a fresh schedule (don't preserve existing)
    setupAutoBackup(request.enabled, frequency, false);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getNextBackupTime') {
    getNextBackupTime(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Handle service worker lifecycle
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - checking for interrupted backup process');
  // Initialize auto backup if enabled
  initializeAutoBackup();
  // Restore backup state from storage
  restoreBackupState();
  // You could add logic here to resume interrupted backups if needed
});

// Handle extension install/enable
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/enabled - initializing auto backup');
  // Initialize auto backup if enabled
  initializeAutoBackup();
  // Restore backup state from storage
  restoreBackupState();
});

chrome.runtime.onSuspend.addListener(async () => {
  console.log(
    'Service worker suspending - saving backup state and cleaning up',
  );

  // Save backup state to storage when suspending (if backup is in progress)
  if (isBackupProcessing && currentBackupStartTime) {
    try {
      // Get the token from storage to preserve it
      const result = await chrome.storage.local.get(['backupToken']);
      await chrome.storage.local.set({
        backupProcessing: isBackupProcessing,
        backupStartTime: currentBackupStartTime,
        backupToken: result.backupToken, // Preserve the token
      });
    } catch (error) {
      console.error('Error saving backup state on suspend:', error);
    }
  }
});
