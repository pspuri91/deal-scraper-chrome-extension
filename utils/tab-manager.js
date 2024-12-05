import { logger } from './logger.js';

export function getCurrentTab() {
  return chrome.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs[0]) {
        logger.background('Found current tab:', tabs[0].id);
        return tabs[0];
      }
      logger.background('No active tab found');
      return null;
    });
}

export function reloadTab(tabId) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.reload(tabId, {}, () => {
        logger.background('Tab reloaded successfully:', tabId);
        resolve();
      });
    } catch (error) {
      logger.error('Background', 'Failed to reload tab', error);
      reject(error);
    }
  });
}