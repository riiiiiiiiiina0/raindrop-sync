import { setBadge, clearBadge } from './components/actionButton.js';
import { showNotification } from './components/notification.js';
import {
  parseRaindropBackup,
  getLatestChange,
  addRaindrops,
  getRootCollections,
  getChildCollections,
  buildCollectionTree,
  getUserData,
  buildCollectionTreeWithGroups,
  fetchRaindropsPaginated,
  createBookmarkFromRaindrop,
  processRaindropsPage,
} from './components/raindrop.js';
import {
  deleteExistingRaindropFolder,
  createBookmarksFromStructure,
  deleteExistingRaindropSyncFolder,
  createCollectionFolderStructure,
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

// Check if sync is needed by comparing the latest change date with the last processed date
async function checkIfSyncNeeded(token) {
  try {
    // Check if local "RaindropSync" bookmark folder exists and is non-empty
    const searchResults = await chrome.bookmarks.search({
      title: 'RaindropSync',
    });
    const folderNodes = searchResults.filter((bookmark) => !bookmark.url); // folders have no URL

    // If there is no folder at all => sync needed
    if (folderNodes.length === 0) {
      console.log(
        'Local "RaindropSync" bookmark folder not found – sync needed',
      );
      const latestChangeTimestamp = await getLatestChange(token);
      return {
        syncNeeded: true,
        latestChangeTimestamp: latestChangeTimestamp || Date.now(),
        reason: 'missing_local_folder',
      };
    }

    // Determine if at least one folder has any children
    const childrenArrays = await Promise.all(
      folderNodes.map((folder) => chrome.bookmarks.getChildren(folder.id)),
    );
    const hasNonEmptyFolder = childrenArrays.some(
      (children) => children.length > 0,
    );

    if (!hasNonEmptyFolder) {
      console.log(
        'Local "RaindropSync" bookmark folder is empty – sync needed',
      );
      const latestChangeTimestamp = await getLatestChange(token);
      return {
        syncNeeded: true,
        latestChangeTimestamp: latestChangeTimestamp || Date.now(),
        reason: 'empty_local_folder',
      };
    }

    // Get the timestamp of the latest change (updated, created, or deleted)
    const latestChangeTimestamp = await getLatestChange(token);

    if (latestChangeTimestamp === null) {
      // No raindrops found at all, so no sync is needed
      return { syncNeeded: false };
    }

    // Get the last processed change date from storage
    const result = await chrome.storage.sync.get(['lastProcessedChangeDate']);
    const lastProcessedDate = result.lastProcessedChangeDate || 0;

    console.log(
      'Latest change date from API:',
      new Date(latestChangeTimestamp).toISOString(),
    );
    console.log(
      'Last processed date from storage:',
      new Date(lastProcessedDate).toISOString(),
    );

    // If the latest change is newer than the last processed date, a sync is needed
    const syncNeeded = latestChangeTimestamp > lastProcessedDate;

    return {
      syncNeeded,
      latestChangeTimestamp,
      reason: syncNeeded ? 'new_changes' : 'up_to_date',
    };
  } catch (error) {
    console.error('Error checking if sync is needed:', error);
    throw error;
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
    sendStatusUpdate('Checking for new changes...', 'info', 'checking');

    // Step 2: Check if sync is needed
    const syncCheck = await checkIfSyncNeeded(token);

    if (!syncCheck.syncNeeded) {
      // No new changes since last sync
      cleanupBackupProcess();
      sendStatusUpdate(
        'No new changes found since last sync. Your bookmarks are up to date!',
        'success',
        'completed',
      );
      return { success: true, message: 'No sync needed - already up to date' };
    }

    // Step 3: Sync needed, prepare collection structure
    let statusMessage = '';
    if (syncCheck.reason === 'missing_local_folder') {
      statusMessage =
        'Local bookmark folder missing. Restoring your Raindrop bookmarks...';
    } else {
      const changeAge = Math.round(
        (Date.now() - (syncCheck.latestChangeTimestamp || Date.now())) /
          (1000 * 60),
      );
      statusMessage = `New changes found! Latest change was ${changeAge} minutes ago. Setting up collection structure...`;
    }

    sendStatusUpdate(statusMessage, 'info', 'preparing');

    // Step 3a: Delete existing bookmark folders
    sendStatusUpdate(
      'Deleting existing bookmark folders...',
      'info',
      'deleting_folders',
    );
    await deleteExistingRaindropFolder(); // Delete old "Raindrop" folder
    await deleteExistingRaindropSyncFolder(); // Delete existing "RaindropSync" folder

    // Step 3b: Fetch user data with groups and collection structure from Raindrop API
    sendStatusUpdate(
      'Fetching user data and collection structure...',
      'info',
      'fetching_collections',
    );
    const [userData, rootCollections, childCollections] = await Promise.all([
      getUserData(token),
      getRootCollections(token),
      getChildCollections(token),
    ]);

    // Step 3c: Build collection tree organized by groups
    const collectionTree = buildCollectionTreeWithGroups(
      rootCollections,
      childCollections,
      userData.groups || [],
    );

    // Step 3d: Create RaindropSync folder in bookmarks bar
    sendStatusUpdate(
      'Creating RaindropSync folder structure...',
      'info',
      'creating_sync_folders',
    );
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

    const raindropSyncFolder = await chrome.bookmarks.create({
      parentId: parentId,
      title: 'RaindropSync',
    });

    // Step 3e: Create collection folder structure
    const collectionToFolderMap = await createCollectionFolderStructure(
      raindropSyncFolder.id,
      collectionTree,
    );

    // Step 3f: Fetch and create bookmarks using paginated API
    sendStatusUpdate(
      'Fetching and creating bookmarks...',
      'info',
      'fetching_raindrops',
    );

    let totalBookmarksCreated = 0;
    let totalBookmarksSkipped = 0;
    let totalBookmarksErrors = 0;

    // Keep track of the index for each folder to preserve order
    const folderIndexMap = new Map();

    // Create callback function to process each page of raindrops
    const processPageCallback = async (
      raindrops,
      pageNumber,
      totalProcessed,
    ) => {
      sendStatusUpdate(
        `Processing page ${pageNumber + 1}: ${raindrops.length} raindrops (${
          totalProcessed + raindrops.length
        } total)...`,
        'info',
        'processing_raindrops',
      );

      // Process this page and create bookmarks
      const pageResult = await processRaindropsPage(
        raindrops,
        collectionToFolderMap,
        undefined,
        folderIndexMap,
      );

      // Update totals
      totalBookmarksCreated += pageResult.successCount;
      totalBookmarksSkipped += pageResult.skipCount;
      totalBookmarksErrors += pageResult.errorCount;

      return pageResult;
    };

    // Fetch all raindrops page by page and create bookmarks
    const fetchResult = await fetchRaindropsPaginated(
      token,
      processPageCallback,
      {}, // Use default options
    );

    sendStatusUpdate(
      `Bookmark creation completed: ${totalBookmarksCreated} created, ${totalBookmarksSkipped} skipped, ${totalBookmarksErrors} errors`,
      totalBookmarksErrors > 0 ? 'warning' : 'success',
      'completed_bookmarks',
    );

    if (fetchResult.success && totalBookmarksCreated > 0) {
      // Save both the import time and the latest change timestamp
      await chrome.storage.sync.set({
        lastImportTime: Date.now(),
        lastProcessedChangeDate: syncCheck.latestChangeTimestamp,
      });

      // Get the actual import time that was saved during sync
      const result = await chrome.storage.sync.get(['lastImportTime']);
      const actualImportTime = result.lastImportTime || Date.now();

      // Send a specific message to refresh timestamps immediately
      try {
        chrome.runtime.sendMessage({
          action: 'refreshTimestamps',
          lastBackupTime: syncCheck.latestChangeTimestamp,
          lastImportTime: actualImportTime,
        });
      } catch (error) {
        console.log('Could not send refresh timestamps message:', error);
      }

      cleanupBackupProcess();
      sendStatusUpdate(
        `Sync completed successfully! Created ${totalBookmarksCreated} bookmarks from ${fetchResult.totalPages} pages.`,
        'success',
        'completed',
      );
      showNotification(
        'Raindrop Sync Complete',
        `Successfully synced ${totalBookmarksCreated} raindrops to your browser bookmarks.`,
        'sync-complete',
      );
      return { success: true, message: 'Sync completed successfully' };
    } else {
      cleanupBackupProcess();
      const errorMessage =
        totalBookmarksCreated === 0
          ? 'No bookmarks were created - check your Raindrop collections'
          : `Partial sync: ${totalBookmarksCreated} bookmarks created with ${totalBookmarksErrors} errors`;
      sendStatusUpdate(errorMessage, 'error', 'failed');
      return { success: false, message: errorMessage };
    }
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
  } else if (notificationId === 'save-success') {
    // Open Raindrop unsorted collection when save success notification is clicked
    chrome.tabs.create({ url: 'https://app.raindrop.io/my/-1' });
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
/**
 * Gets highlighted tabs or current active tab and saves them to Raindrop and local bookmarks.
 * @param {string} token - The Raindrop API token
 */
async function saveCurrentTabsToRaindrop(token) {
  try {
    setBadge('📥');
    sendStatusUpdate('Getting tabs to save...', 'info', 'save_tabs');

    // Get highlighted tabs first, or current active tab if none highlighted
    const tabs = await getTabsToSave();

    if (tabs.length === 0) {
      showNotification(
        'Raindrop Save',
        'No valid tabs to save.',
        'save-no-tabs',
      );
      sendStatusUpdate('No valid tabs found to save.', 'error', 'save_tabs');
      setBadge('Error');
      setTimeout(() => clearBadge(), 3000);
      return;
    }

    sendStatusUpdate(
      `Saving ${tabs.length} tab(s) to Raindrop...`,
      'info',
      'save_tabs',
    );

    // Convert tabs to raindrop format with pleaseParse
    const raindrops = tabs.map((tab) => ({
      link: tab.url,
      title: tab.title,
      collection: { $id: -1 }, // -1 is unsorted collection
      pleaseParse: {},
    }));

    // Save to Raindrop
    const savedRaindrops = await addRaindrops(token, raindrops);
    console.log(
      `Saved ${savedRaindrops.length} of ${tabs.length} raindrops to Raindrop.io`,
    );

    if (savedRaindrops.length > 0) {
      // Filter the original tabs to only include those that were successfully saved
      const savedUrls = new Set(savedRaindrops.map((r) => r.link));
      const successfullySavedTabs = tabs.filter((t) => savedUrls.has(t.url));

      // Save to local bookmarks under RaindropSync > Unsorted
      if (successfullySavedTabs.length > 0) {
        await saveTabsToLocalBookmarks(successfullySavedTabs);
      }

      // Show success notification
      const tabWord = successfullySavedTabs.length === 1 ? 'tab' : 'tabs';
      showNotification(
        'Raindrop Save Complete',
        `Successfully saved ${successfullySavedTabs.length} ${tabWord} to Raindrop and bookmarks`,
        'save-success',
      );
      sendStatusUpdate(
        `Successfully saved ${successfullySavedTabs.length} ${tabWord}`,
        'success',
        'save_tabs',
      );

      if (savedRaindrops.length < tabs.length) {
        // Partial success, show a notification but no error badge
        const failedCount = tabs.length - savedRaindrops.length;
        const failedTabWord = failedCount === 1 ? 'tab' : 'tabs';
        showNotification(
          'Raindrop Partial Save',
          `Could not save ${failedCount} ${failedTabWord}.`,
          'save-partial-error',
        );
      }

      clearBadge();
    } else {
      // All tabs failed to save
      showNotification(
        'Raindrop Save Failed',
        `Failed to save ${tabs.length} tab(s).`,
        'save-error',
      );
      sendStatusUpdate(
        `Failed to save ${tabs.length} tab(s).`,
        'error',
        'save_tabs',
      );
      setBadge('Error');
      setTimeout(() => clearBadge(), 3000);
    }
  } catch (error) {
    console.error('Error saving tabs to Raindrop:', error);
    showNotification(
      'Raindrop Save Failed',
      `Failed to save tabs: ${error.message}`,
      'save-error',
    );
    sendStatusUpdate(
      `Failed to save tabs: ${error.message}`,
      'error',
      'save_tabs',
    );
    setBadge('Error');
    setTimeout(() => clearBadge(), 3000);
  }
}

/**
 * Gets tabs to save - highlighted tabs if any, otherwise current active tab.
 * @returns {Promise<Array>} Array of tab objects to save
 */
async function getTabsToSave() {
  return new Promise((resolve) => {
    // First try to get highlighted tabs
    chrome.tabs.query(
      { highlighted: true, currentWindow: true },
      (highlightedTabs) => {
        if (highlightedTabs && highlightedTabs.length > 0) {
          // Filter out chrome:// and other non-web URLs
          const validTabs = highlightedTabs.filter(
            (tab) =>
              tab.url &&
              (tab.url.startsWith('http://') || tab.url.startsWith('https://')),
          );
          resolve(validTabs);
        } else {
          // Fallback to current active tab
          chrome.tabs.query(
            { active: true, currentWindow: true },
            (activeTabs) => {
              if (activeTabs && activeTabs.length > 0) {
                const activeTab = activeTabs[0];
                if (
                  activeTab.url &&
                  (activeTab.url.startsWith('http://') ||
                    activeTab.url.startsWith('https://'))
                ) {
                  resolve([activeTab]);
                } else {
                  resolve([]);
                }
              } else {
                resolve([]);
              }
            },
          );
        }
      },
    );
  });
}

/**
 * Saves tabs to local bookmarks under RaindropSync > Unsorted folder.
 * @param {Array} tabs - Array of tab objects to save
 */
async function saveTabsToLocalBookmarks(tabs) {
  try {
    // Find or create RaindropSync folder
    const raindropSyncFolder = await findOrCreateRaindropSyncFolder();

    // Find or create Unsorted folder under RaindropSync
    const unsortedFolder = await findOrCreateUnsortedFolder(
      raindropSyncFolder.id,
    );

    // Create bookmarks for each tab (at the front of the folder)
    for (const tab of tabs) {
      await chrome.bookmarks.create({
        parentId: unsortedFolder.id,
        title: tab.title || 'Untitled',
        url: tab.url,
        index: 0, // Place at the front of the folder
      });
      console.log(`Created bookmark: ${tab.title} -> ${tab.url}`);
    }
  } catch (error) {
    console.error('Error saving tabs to local bookmarks:', error);
    throw error;
  }
}

/**
 * Finds or creates the RaindropSync folder in bookmarks.
 * @returns {Promise<Object>} The RaindropSync folder bookmark object
 */
async function findOrCreateRaindropSyncFolder() {
  // Search for existing RaindropSync folder
  const searchResults = await chrome.bookmarks.search({
    title: 'RaindropSync',
  });

  for (const bookmark of searchResults) {
    // Check if this is a folder (no URL means it's a folder)
    if (!bookmark.url) {
      return bookmark;
    }
  }

  // If not found, create it in the bookmark bar
  const bookmarkBar = await findBookmarkBar();
  return await chrome.bookmarks.create({
    parentId: bookmarkBar.id,
    title: 'RaindropSync',
  });
}

/**
 * Finds or creates the Unsorted folder under RaindropSync.
 * @param {string} parentId - The parent folder ID (RaindropSync folder)
 * @returns {Promise<Object>} The Unsorted folder bookmark object
 */
async function findOrCreateUnsortedFolder(parentId) {
  // Get children of RaindropSync folder
  const children = await chrome.bookmarks.getChildren(parentId);

  // Look for existing Unsorted folder
  for (const child of children) {
    if (!child.url && child.title === 'Unsorted') {
      return child;
    }
  }

  // If not found, create it
  return await chrome.bookmarks.create({
    parentId: parentId,
    title: 'Unsorted',
  });
}

/**
 * Finds the bookmark bar folder.
 * @returns {Promise<Object>} The bookmark bar folder object
 */
async function findBookmarkBar() {
  const bookmarkTree = await chrome.bookmarks.getTree();
  const rootNode = bookmarkTree[0];

  // Look for bookmark bar (usually the first child)
  if (rootNode.children) {
    for (const child of rootNode.children) {
      if (
        !child.url &&
        (child.title === 'Bookmarks bar' || child.title === 'Bookmarks Bar')
      ) {
        return child;
      }
    }

    // Fallback to first folder if bookmark bar not found by name
    for (const child of rootNode.children) {
      if (!child.url) {
        return child;
      }
    }
  }

  throw new Error('Could not find bookmark bar');
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/enabled - initializing auto backup');
  // Initialize auto backup if enabled
  initializeAutoBackup();
  // Restore backup state from storage
  cleanup();

  // On install or update, check for token and open options page if missing
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.storage.sync.get('raindropToken', (result) => {
      if (!result.raindropToken) {
        const optionsUrl = chrome.runtime.getURL('src/options.html');
        // Add a query parameter to indicate the reason for opening
        chrome.tabs.create({ url: `${optionsUrl}?reason=install` });
      }
    });
  }
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
    const optionsUrl = chrome.runtime.getURL('src/options.html');
    chrome.tabs.create({ url: `${optionsUrl}?reason=missing_token` });
    return;
  }

  switch (actionButtonBehavior) {
    case 'sync':
      startBackup();
      break;
    case 'open_options':
      chrome.runtime.openOptionsPage();
      break;
    case 'save':
    default:
      await saveCurrentTabsToRaindrop(raindropToken);
      break;
  }
});
