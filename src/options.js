document.addEventListener('DOMContentLoaded', function () {
  const theme = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  document.documentElement.setAttribute('data-theme', theme);

  const apiTokenInput = /** @type {HTMLInputElement} */ (
    document.getElementById('apiToken')
  );
  const verifyButton = /** @type {HTMLButtonElement} */ (
    document.getElementById('verifyButton')
  );
  const statusDiv = /** @type {HTMLDivElement} */ (
    document.getElementById('status')
  );
  const backupButton = /** @type {HTMLButtonElement} */ (
    document.getElementById('backupButton')
  );
  const backupStatusDiv = /** @type {HTMLDivElement} */ (
    document.getElementById('backupStatus')
  );
  const lastImportTimeElement = /** @type {HTMLSpanElement} */ (
    document.getElementById('lastImportTime')
  );
  const nextBackupTimeElement = /** @type {HTMLSpanElement} */ (
    document.getElementById('nextBackupTime')
  );
  const showNotificationsCheckbox = /** @type {HTMLInputElement} */ (
    document.getElementById('showNotifications')
  );
  const actionButtonBehaviorSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById('actionButtonBehavior')
  );

  // Check if all elements exist
  if (
    !apiTokenInput ||
    !verifyButton ||
    !statusDiv ||
    !backupButton ||
    !backupStatusDiv ||
    !lastImportTimeElement ||
    !nextBackupTimeElement ||
    !showNotificationsCheckbox ||
    !actionButtonBehaviorSelect
  ) {
    console.error('Required elements not found');
    return;
  }

  // Check for query params and highlight if necessary
  const urlParams = new URLSearchParams(window.location.search);
  const reason = urlParams.get('reason');
  if (reason === 'install' || reason === 'missing_token') {
    const apiTokenGroup = apiTokenInput.closest('.form-group');
    if (apiTokenGroup) {
      apiTokenGroup.classList.add('highlight');
      // Focus after a short delay to ensure the page is fully rendered
      setTimeout(() => apiTokenInput.focus(), 100);
    }
    // Show a helpful message
    showStatus('Please enter your API token to get started.', 'info');
  }

  // Load saved token when page loads
  loadSavedToken();

  // Load saved timestamps when page loads
  loadTimestamps();

  // Load next backup time when page loads
  loadNextBackupTime();

  // Load notification setting when page loads
  loadNotificationSetting();

  // Load action button behavior setting when page loads
  loadActionButtonBehavior();

  // Save notification setting when checkbox is changed
  showNotificationsCheckbox.addEventListener('change', saveNotificationSetting);

  // Save action button behavior setting when select is changed
  actionButtonBehaviorSelect.addEventListener(
    'change',
    saveActionButtonBehavior,
  );

  // Check backup status when page loads
  checkBackupStatus();

  // Validate and save token when verify button is clicked
  verifyButton.addEventListener('click', validateAndSaveToken);

  // Start backup process when backup button is clicked
  backupButton.addEventListener('click', startBackupProcess);

  // Listen for status updates from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'statusUpdate') {
      showBackupStatus(request.status, request.type);
      updateButtonState(request.step, request.isProcessing);

      // Reload timestamps when backup completes successfully
      if (request.type === 'success' && request.step === 'completed') {
        setTimeout(() => {
          loadTimestamps();
          loadNextBackupTime(); // Also refresh next backup time
        }, 1000); // Small delay to ensure storage is updated
      }
    } else if (request.action === 'refreshTimestamps') {
      // Handle direct timestamp refresh with provided values
      if (request.lastImportTime) {
        lastImportTimeElement.textContent = formatTimestamp(
          request.lastImportTime,
        );
      }
      // Also reload from storage to ensure consistency
      setTimeout(() => {
        loadTimestamps();
      }, 500);
    }
  });

  async function loadSavedToken() {
    chrome.storage.sync.get(['raindropToken'], async function (result) {
      if (result.raindropToken) {
        apiTokenInput.value = result.raindropToken;
        updateControlsDisabledState(false);
      } else {
        updateControlsDisabledState(true);
      }
    });
  }

  function loadTimestamps() {
    chrome.storage.sync.get(
      ['lastProcessedRaindropDate', 'lastImportTime'],
      function (result) {
        if (result.lastImportTime) {
          lastImportTimeElement.textContent = formatTimestamp(
            result.lastImportTime,
          );
        }
      },
    );
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  async function loadNextBackupTime() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNextBackupTime',
      });

      if (response && response.success && response.nextBackupTime) {
        nextBackupTimeElement.textContent = formatTimestamp(
          response.nextBackupTime,
        );
      } else {
        nextBackupTimeElement.textContent = 'Not scheduled';
      }
    } catch (error) {
      console.log('Could not get next backup time:', error);
      nextBackupTimeElement.textContent = 'Not scheduled';
    }
  }

  async function validateAndSaveToken() {
    const token = apiTokenInput.value.trim();
    if (!token) {
      showStatus('Please enter a token.', 'info');
      updateControlsDisabledState(true);
      return;
    }

    showStatus('Validating token...', 'info');
    updateControlsDisabledState(true); // Disable buttons during validation

    try {
      const response = await fetch('https://api.raindrop.io/rest/v1/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        showStatus(
          `Token is valid! Logged in as: ${
            userData.user.fullName || userData.user.email
          }`,
          'success',
        );
        saveTokenAfterValidation(token);
        updateControlsDisabledState(false); // Enable buttons after successful validation

        // Remove highlight after successful validation
        const apiTokenGroup = apiTokenInput.closest('.form-group');
        if (apiTokenGroup) {
          apiTokenGroup.classList.remove('highlight');
        }
      } else {
        showStatus(
          `Token is invalid: ${response.status} ${response.statusText}`,
          'error',
        );
        updateControlsDisabledState(true); // Keep buttons disabled if validation fails
      }
    } catch (error) {
      showStatus(`Validation error: ${error.message}`, 'error');
      updateControlsDisabledState(true); // Keep buttons disabled on error
    }
  }

  function saveTokenAfterValidation(token) {
    chrome.storage.sync.set(
      {
        raindropToken: token,
      },
      function () {
        if (chrome.runtime.lastError) {
          showStatus(
            'Error saving token: ' + chrome.runtime.lastError.message,
            'error',
          );
        } else {
          // The success message is already shown by validateAndSaveToken
        }
      },
    );
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    }
  }

  function showBackupStatus(message, type) {
    backupStatusDiv.textContent = message;
    backupStatusDiv.className = `status ${type}`;
    backupStatusDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        backupStatusDiv.style.display = 'none';
      }, 5000);
    }
  }

  function updateButtonState(step, isProcessing) {
    if (isProcessing) {
      backupButton.disabled = true;
      backupButton.className = 'backup-button processing';

      // Update button text based on current step
      switch (step) {
        case 'checking':
          backupButton.textContent = '⏳ Checking for recent backup...';
          break;
        case 'creating':
          backupButton.textContent = '⏳ Creating backup...';
          break;
        case 'polling':
          backupButton.textContent = '⏳ Waiting for backup...';
          break;
        case 'downloading':
          backupButton.textContent = '⏳ Downloading...';
          break;
        default:
          backupButton.textContent = '⏳ Processing...';
      }
    } else {
      // Reset button to normal state
      updateControlsDisabledState(false);
      backupButton.className = 'backup-button';
      backupButton.textContent = 'Sync Raindrops Now';
    }
  }

  function updateControlsDisabledState(isDisabled) {
    backupButton.disabled = isDisabled;
  }

  async function checkBackupStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getBackupStatus',
      });

      if (response && response.isProcessing) {
        showBackupStatus('Backup process is running in background...', 'info');
        updateButtonState('processing', true);
      }
    } catch (error) {
      console.log('Could not get backup status:', error);
    }
  }

  async function startBackupProcess() {
    const token = apiTokenInput.value.trim();
    if (!token) {
      showBackupStatus('Please enter and save your API token first', 'error');
      return;
    }

    try {
      showBackupStatus('Starting backup process...', 'info');

      const response = await chrome.runtime.sendMessage({
        action: 'startBackup',
      });

      if (response && !response.success) {
        showBackupStatus(response.message || 'Failed to start backup', 'error');
      }
    } catch (error) {
      console.error('Error starting backup process:', error);
      showBackupStatus(`Error starting backup: ${error.message}`, 'error');
    }
  }

  function loadNotificationSetting() {
    chrome.storage.sync.get(['showNotifications'], function (result) {
      showNotificationsCheckbox.checked = result.showNotifications !== false;
    });
  }

  function saveNotificationSetting() {
    chrome.storage.sync.set({
      showNotifications: showNotificationsCheckbox.checked,
    });
  }

  function loadActionButtonBehavior() {
    chrome.storage.sync.get(['actionButtonBehavior'], function (result) {
      if (result.actionButtonBehavior) {
        actionButtonBehaviorSelect.value = result.actionButtonBehavior;
      }
    });
  }

  function saveActionButtonBehavior() {
    chrome.storage.sync.set({
      actionButtonBehavior: actionButtonBehaviorSelect.value,
    });
  }
});
