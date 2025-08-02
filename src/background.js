import { setBadge, clearBadge } from './components/actionButton.js';
import { showNotification } from './components/notification.js';
import {
  getCollections,
  getRaindropsUpdatedSince,
  getRaindropByIds,
  getUserData,
  buildCollectionTreeWithGroups,
} from './components/raindrop.js';
import {
  createBookmark,
  updateBookmark,
  deleteBookmark,
  createFolder,
  updateFolder,
  deleteFolder,
  getLocalBookmarks,
  getLocalFolders,
} from './components/bookmarks.js';
import {
  getMetadata,
  setMetadata,
  getCollectionMapping,
  setCollectionMapping,
  getRaindropMapping,
  setRaindropMapping,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from './components/metadata.js';

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

async function syncCollections(token, rootFolderId) {
  const [collections, userData, localFolders, collectionMapping] =
    await Promise.all([
      getCollections(token),
      getUserData(token),
      getLocalFolders(rootFolderId),
      getCollectionMapping(),
    ]);

  const remoteCollections = new Map(collections.map((c) => [c._id, c]));
  const localFoldersById = new Map(
    Array.from(localFolders.values()).map((f) => [f.id, f]),
  );

  // Sync remote to local
  for (const collection of collections) {
    try {
      const folderId = collectionMapping.get(collection._id);
      if (folderId && localFoldersById.has(folderId)) {
        // Existing folder, check for updates
        const folder = localFoldersById.get(folderId);
        if (folder.title !== collection.title) {
          await updateFolder(folderId, { title: collection.title });
        }
      } else {
        // New folder
        const parentId = collection.parent
          ? collectionMapping.get(collection.parent.$id)
          : rootFolderId;
        if (parentId) {
          const newFolder = await createFolder(parentId, collection.title);
          collectionMapping.set(collection._id, newFolder.id);
        }
      }
    } catch (error) {
      console.error(
        `Error processing collection ${collection._id}:`,
        error,
      );
    }
  }

  // Sync local to remote (deletions)
  for (const [collectionId, folderId] of collectionMapping.entries()) {
    if (!remoteCollections.has(collectionId)) {
      try {
        await deleteFolder(folderId);
      } catch (error) {
        console.error(`Error deleting folder ${folderId}:`, error);
      }
      collectionMapping.delete(collectionId);
    }
  }

  await setCollectionMapping(collectionMapping);
}

async function syncRaindrops(token, rootFolderId) {
  const lastSync = await getLastSyncTimestamp();
  const [
    updatedRaindrops,
    localBookmarks,
    raindropMapping,
    collectionMapping,
  ] = await Promise.all([
    getRaindropsUpdatedSince(token, lastSync),
    getLocalBookmarks(rootFolderId),
    getRaindropMapping(),
    getCollectionMapping(),
  ]);

  const localBookmarksById = new Map(
    Array.from(localBookmarks.values()).map((b) => [b.id, b]),
  );

  // Sync remote to local
  for (const raindrop of updatedRaindrops) {
    try {
      const bookmarkId = raindropMapping.get(raindrop._id);
      if (bookmarkId && localBookmarksById.has(bookmarkId)) {
        // Existing bookmark, check for updates
        const bookmark = localBookmarksById.get(bookmarkId);
        const changes = {};
        if (bookmark.title !== raindrop.title) {
          changes.title = raindrop.title;
        }
        if (bookmark.url !== raindrop.link) {
          changes.url = raindrop.link;
        }
        if (Object.keys(changes).length > 0) {
          await updateBookmark(bookmarkId, changes);
        }
      } else {
        // New bookmark
        const parentId = collectionMapping.get(raindrop.collection.$id);
        if (parentId) {
          const newBookmark = await createBookmark(
            parentId,
            raindrop.title,
            raindrop.link,
          );
          raindropMapping.set(raindrop._id, newBookmark.id);
        }
      }
    } catch (error) {
      console.error(`Error processing raindrop ${raindrop._id}:`, error);
    }
  }

  // Sync deleted raindrops
  const deletedRaindrops = await getRaindropsUpdatedSince(token, lastSync, -99);
  for (const raindrop of deletedRaindrops) {
    const bookmarkId = raindropMapping.get(raindrop._id);
    if (bookmarkId) {
      try {
        await deleteBookmark(bookmarkId);
      } catch (error) {
        console.error(`Error deleting bookmark ${bookmarkId}:`, error);
      }
      raindropMapping.delete(raindrop._id);
    }
  }

  await setRaindropMapping(raindropMapping);
}

async function startBackupProcess(token) {
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
    setBadge('⏳');
    sendStatusUpdate('Starting incremental sync...', 'info', 'starting');

    let rootFolder = (
      await chrome.bookmarks.search({ title: 'RaindropSync' })
    ).find((b) => !b.url);
    if (!rootFolder) {
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
      rootFolder = await createFolder(parentId, 'RaindropSync');
    }

    await syncCollections(token, rootFolder.id);
    await syncRaindrops(token, rootFolder.id);

    await setLastSyncTimestamp(Date.now());

    cleanupBackupProcess();
    sendStatusUpdate('Incremental sync completed successfully!', 'success');
    showNotification(
      'Raindrop Sync Complete',
      'Your bookmarks are now up to date.',
      'sync-complete',
    );
    return { success: true, message: 'Sync completed successfully' };
  } catch (error) {
    console.error('Sync process error:', error);
    cleanupBackupProcess();
    sendStatusUpdate(`Sync failed: ${error.message}`, 'error');
    showNotification(
      'Raindrop Sync Failed',
      `Sync process failed: ${error.message}`,
      'backup-failed',
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

// Notification click listener
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'sync-complete') {
    chrome.tabs.create({ url: 'chrome://bookmarks' });
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
  const { raindropToken, actionButtonBehavior } = await new Promise(
    (resolve) => {
      chrome.storage.sync.get(
        ['raindropToken', 'actionButtonBehavior'],
        (result) => {
          resolve(result);
        },
      );
    },
  );

  if (!raindropToken) {
    chrome.runtime.openOptionsPage();
    return;
  }

  switch (actionButtonBehavior) {
    case 'sync':
      startBackup();
      break;
    case 'open_options':
      chrome.runtime.openOptionsPage();
      break;
    default:
      break;
  }
});
