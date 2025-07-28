document.addEventListener('DOMContentLoaded', function () {
  const apiTokenInput = /** @type {HTMLInputElement} */ (
    document.getElementById('apiToken')
  );
  const saveButton = /** @type {HTMLButtonElement} */ (
    document.getElementById('saveButton')
  );
  const testButton = /** @type {HTMLButtonElement} */ (
    document.getElementById('testButton')
  );
  const statusDiv = /** @type {HTMLDivElement} */ (
    document.getElementById('status')
  );

  // Check if all elements exist
  if (!apiTokenInput || !saveButton || !testButton || !statusDiv) {
    console.error('Required elements not found');
    return;
  }

  // Load saved token when page loads
  loadSavedToken();

  // Save token when save button is clicked
  saveButton.addEventListener('click', saveToken);

  // Test connection when test button is clicked
  testButton.addEventListener('click', testConnection);

  // Save token when Enter is pressed in the input field
  apiTokenInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      saveToken();
    }
  });

  function loadSavedToken() {
    chrome.storage.sync.get(['raindropToken'], function (result) {
      if (result.raindropToken) {
        apiTokenInput.value = result.raindropToken;
      }
    });
  }

  function saveToken() {
    const token = apiTokenInput.value.trim();

    if (!token) {
      showStatus('Please enter a token', 'error');
      return;
    }

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
          showStatus('Token saved successfully!', 'success');
        }
      },
    );
  }

  async function testConnection() {
    const token = apiTokenInput.value.trim();

    if (!token) {
      showStatus('Please enter a token first', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');
    testButton.disabled = true;
    testButton.textContent = 'Testing...';

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
          `Connection successful! Logged in as: ${
            userData.user.fullName || userData.user.email
          }`,
          'success',
        );
      } else {
        showStatus(
          `Connection failed: ${response.status} ${response.statusText}`,
          'error',
        );
      }
    } catch (error) {
      showStatus(`Connection error: ${error.message}`, 'error');
    } finally {
      testButton.disabled = false;
      testButton.textContent = 'Test Connection';
    }
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
});
