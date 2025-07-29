import { setBadge, clearBadge } from './components/actionButton.js';
import { showNotification } from './components/notification.js';
import {
  parseRaindropBackup,
  getLatestRaindrop,
  exportAllRaindrops,
  addRaindrops,
} from './components/raindrop.js';
import {
  deleteExistingRaindropFolder,
  createBookmarksFromStructure,
} from './components/bookmarks.js';

console.log('Raindrop Sync background service worker started');

// Global state for backup process
let isBackupProcessing = false;
let backupTimeoutId = null;
let currentBackupStartTime = null;

// Cleanup backup state from storage on startup
async function cleanup() {
  try {
    // Clean up any stale polling alarms from previous sessions
    await cleanupStaleAlarms();

    // Clear any leftover backup state since new approach doesn't need persistence
    await clearBackupState();

    console.log('Backup state cleaned up on startup');
  } catch (error) {
    console.error('Error cleaning up backup state:', error);
  }
}

// Cleanup backup process
function cleanupBackupProcess() {
  isBackupProcessing = false;
  currentBackupStartTime = null;

  // Clear timeouts (still needed for potential future use)
  if (backupTimeoutId) {
    clearTimeout(backupTimeoutId);
    backupTimeoutId = null;
  }

  // Reset badge
  clearBadge();

  // Clear local storage state
  clearBackupState();

  // Send cleanup notification to options page
  sendStatusUpdate('Process cleanup completed', 'info', 'cleanup');
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

// Check if sync is needed by comparing latest raindrop date with last processed date
async function checkIfSyncNeeded(token) {
  try {
    // Get the latest raindrop
    const latestRaindrop = await getLatestRaindrop(token);
    const latestRaindropDate = new Date(latestRaindrop.created).getTime();

    // Get the last processed raindrop date from storage
    const result = await chrome.storage.sync.get(['lastProcessedRaindropDate']);
    const lastProcessedDate = result.lastProcessedRaindropDate || 0;

    console.log(
      'Latest raindrop date:',
      new Date(latestRaindropDate).toISOString(),
    );
    console.log(
      'Last processed date:',
      new Date(lastProcessedDate).toISOString(),
    );

    // If latest raindrop is newer than last processed, sync is needed
    const syncNeeded = latestRaindropDate > lastProcessedDate;

    return {
      syncNeeded,
      latestRaindrop,
      latestRaindropDate,
      lastProcessedDate,
    };
  } catch (error) {
    console.error('Error checking if sync is needed:', error);
    throw error;
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

// Main backup process function - rewritten for new approach
async function startBackupProcess(token) {
  // Prevent multiple concurrent backup processes
  if (isBackupProcessing) {
    sendStatusUpdate('Sync is already in progress. Please wait...', 'info');
    return { success: false, message: 'Already in progress' };
  }

  if (!token) {
    sendStatusUpdate('No API token provided', 'error');
    return { success: false, message: 'No token provided' };
  }

  try {
    isBackupProcessing = true;
    currentBackupStartTime = Date.now();

    // Step 1: Show loading badge and status
    setBadge('⏳');
    sendStatusUpdate('Checking for new raindrops...', 'info', 'checking');

    // Step 2: Check if sync is needed
    const syncCheck = await checkIfSyncNeeded(token);

    if (!syncCheck.syncNeeded) {
      // No new raindrops since last sync
      cleanupBackupProcess();
      sendStatusUpdate(
        'No new raindrops found since last sync. Your bookmarks are up to date!',
        'success',
        'completed',
      );
      return { success: true, message: 'No sync needed - already up to date' };
    }

    // Step 3: New raindrops found, export all raindrops
    const raindropAge = Math.round(
      (Date.now() - syncCheck.latestRaindropDate) / (1000 * 60),
    );
    sendStatusUpdate(
      `New raindrops found! Latest added ${raindropAge} minutes ago. Exporting...`,
      'info',
      'exporting',
    );

    const htmlContent = await exportAllRaindrops(token);

    // Step 4: Parse and import bookmarks
    sendStatusUpdate(
      'Importing raindrops to bookmarks...',
      'info',
      'importing',
    );

    const syncSuccess = await syncRaindropBookmarks(htmlContent);
    if (syncSuccess) {
      // Save the latest raindrop date as the last processed date
      await chrome.storage.sync.set({
        lastProcessedRaindropDate: syncCheck.latestRaindropDate,
      });

      // Get the actual import time that was saved during sync
      const result = await chrome.storage.sync.get(['lastImportTime']);
      const actualImportTime = result.lastImportTime || Date.now();

      // Send a specific message to refresh timestamps immediately
      try {
        chrome.runtime.sendMessage({
          action: 'refreshTimestamps',
          lastBackupTime: syncCheck.latestRaindropDate,
          lastImportTime: actualImportTime,
        });
      } catch (error) {
        console.log('Could not send refresh timestamps message:', error);
      }

      cleanupBackupProcess();
      sendStatusUpdate(
        'Raindrops exported and imported successfully!',
        'success',
        'completed',
      );
      showNotification(
        'Raindrop Sync Complete',
        'Your Raindrop.io bookmarks have been imported to browser bookmarks successfully.',
      );
      return { success: true, message: 'Sync completed successfully' };
    } else {
      cleanupBackupProcess();
      return { success: false, message: 'Failed to import bookmarks' };
    }
  } catch (error) {
    console.error('Sync process error:', error);
    cleanupBackupProcess();
    sendStatusUpdate(`Sync failed: ${error.message}`, 'error');
    showNotification(
      'Raindrop Sync Failed',
      `Sync process failed: ${error.message}`,
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
        const periodInMinutes = 15;

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
    const delayInMinutes = 15,
      periodInMinutes = 15;

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
    // Auto backup is always enabled, get the stored next backup time
    const result = await chrome.storage.sync.get(['nextAutoBackupTime']);

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
    // Auto backup is always enabled with 15-minute frequency
    setupAutoBackup(true, '15min');
    console.log('Auto backup initialized on startup with frequency: 15min');
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
      const nextBackupTime = Date.now() + 15 * 60 * 1000; // 15 minutes
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
    // Auto backup is always enabled with 15-minute frequency
    // When user updates settings, create a fresh schedule (don't preserve existing)
    setupAutoBackup(true, '15min', false);
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
  cleanup();
  // You could add logic here to resume interrupted backups if needed
});

// Handle extension install/enable
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/enabled - initializing auto backup');
  // Initialize auto backup if enabled
  initializeAutoBackup();
  // Restore backup state from storage
  cleanup();
});

chrome.runtime.onSuspend.addListener(async () => {
  console.log('Service worker suspending - cleaning up');

  // Clean up any state since new approach doesn't need persistence
  cleanupBackupProcess();
});

chrome.action.onClicked.addListener(async () => {
  const token = await new Promise((resolve) => {
    chrome.storage.sync.get(['raindropToken'], (result) => {
      resolve(result.raindropToken);
    });
  });

  if (!token) {
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    await setBadge('⏳');

    const tabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
    const raindrops = tabs.map((tab) => ({
      link: tab.url,
      title: tab.title,
      pleaseParse: {},
    }));

    await addRaindrops(token, raindrops);

    const searchResults = await chrome.bookmarks.search({ title: 'Raindrop' });
    let parentId = '1';
    if (searchResults.length > 0) {
      const raindropFolder = searchResults.find((bookmark) => !bookmark.url);
      if (raindropFolder) {
        parentId = raindropFolder.id;
      }
    } else {
      const newFolder = await chrome.bookmarks.create({
        parentId: '1',
        title: 'Raindrop',
      });
      parentId = newFolder.id;
    }

    for (const tab of tabs) {
      await chrome.bookmarks.create({
        parentId,
        title: tab.title,
        url: tab.url,
      });
    }

    await setBadge('✅');
  } catch (error) {
    console.error('Failed to add bookmark:', error);
    await setBadge('😵‍💫');
  } finally {
    setTimeout(() => clearBadge(), 3000);
  }
});
