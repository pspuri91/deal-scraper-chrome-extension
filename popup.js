document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const intervalInput = document.getElementById('intervalSeconds');
  const lastItemIdInput = document.getElementById('lastItemId');

  // Load saved settings
  chrome.storage.local.get(['intervalSeconds', 'lastItemId', 'isRunning'], (result) => {
    console.log('[Popup] Loading saved settings:', result);
    intervalInput.value = result.intervalSeconds || '60';
    lastItemIdInput.value = result.lastItemId || '0';
    updateButtonStates(result.isRunning);
  });

  startButton.addEventListener('click', () => {
    console.log('[Popup] Start button clicked');
    const settings = {
      intervalSeconds: parseInt(intervalInput.value, 10) || 60,
      lastItemId: parseInt(lastItemIdInput.value, 10) || 0,
      isRunning: true
    };

    chrome.storage.local.set(settings, () => {
      chrome.runtime.sendMessage({ 
        action: 'startScraping', 
        settings 
      }, (response) => {
        console.log('[Popup] Start scraping response:', response);
        updateButtonStates(true);
      });
    });
  });

  stopButton.addEventListener('click', () => {
    console.log('[Popup] Stop button clicked');
    chrome.storage.local.set({ isRunning: false }, () => {
      chrome.runtime.sendMessage({ 
        action: 'stopScraping' 
      }, (response) => {
        console.log('[Popup] Stop scraping response:', response);
        updateButtonStates(false);
      });
    });
  });

  function updateButtonStates(isRunning) {
    console.log('[Popup] Updating button states:', { isRunning });
    startButton.disabled = isRunning;
    stopButton.disabled = !isRunning;
    startButton.style.opacity = isRunning ? '0.5' : '1';
    stopButton.style.opacity = !isRunning ? '0.5' : '1';
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateLastFetchedId') {
      console.log('[Popup] Updating last fetched ID:', request.lastItemId);
      lastItemIdInput.value = request.lastItemId;
    }
  });
});