import { logger } from './utils/logger.js';
import { showNotification } from './utils/notifications.js';
import { getCurrentTab } from './utils/tab-manager.js';

let intervalId = null;
let lastExecutionTime = null;
let scrapingTabId = null;
let currentSettings = null;

logger.background('Background script initialized');

if (typeof chrome !== 'undefined') {
  logger.background('Chrome API is available');
  if (chrome.alarms) {
    logger.background('chrome.alarms API is available');
  } else {
    logger.error('Background', 'chrome.alarms API is not available');
  }
} else {
  logger.error('Background', 'Chrome API is not available');
}

function startScraping(settings) {
  stopScraping();
  
  currentSettings = settings;
  logger.background('Starting scraping with settings:', settings);

  getCurrentTab().then(tab => {
    if (tab) {
      scrapingTabId = tab.id;
      logger.background('Stored scraping tab ID:', scrapingTabId);
      
      executeScraperCycle(settings);
      
      if (chrome.alarms) {
        chrome.alarms.create('scrapeAlarm', { periodInMinutes: settings.intervalSeconds / 60 });
        
        chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'scrapeAlarm') {
            logger.background('Alarm triggered, executing scraper cycle');
            executeScraperCycle(currentSettings);
          }
        });
      } else {
        logger.error('Background', 'chrome.alarms API is not available');
      }
    } else {
      logger.error('Background', 'No active tab found to start scraping');
    }
  }).catch(error => {
    logger.error('Background', 'Error getting current tab:', error);
  });
}

async function executeScraperCycle(settings) {
  logger.background('Executing scraper cycle with settings:', settings);
  lastExecutionTime = new Date();
  
  try {
    if (scrapingTabId) {
      logger.background('Using stored tab ID for scraping:', scrapingTabId);
      
      chrome.tabs.get(scrapingTabId, (tab) => {
        if (chrome.runtime.lastError) {
          logger.error('Background', 'Tab no longer exists:', chrome.runtime.lastError);
          stopScraping();
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: scrapingTabId },
          files: ['content/scraper.js']
        }).then(() => {
          logger.background('Content script loaded, executing scraper');
          return chrome.scripting.executeScript({
            target: { tabId: scrapingTabId },
            func: (lastItemId) => {
              if (typeof window.scrapeContent === 'function') {
                window.scrapeContent(lastItemId);
              } else {
                console.error('[Content] scrapeContent function not found');
              }
            },
            args: [settings.lastItemId]
          });
        }).then(() => {
          logger.background('Scraper executed successfully');
        }).catch((error) => {
          logger.error('Background', 'Failed to execute scraper', error);
        });
      });
    } else {
      logger.error('Background', 'No stored tab ID found for scraping');
    }
  } catch (error) {
    logger.error('Background', 'Error in scraper cycle', error);
  }
}

function stopScraping() {
  if (intervalId) {
    logger.background('Stopping scraping, clearing interval:', intervalId);
    clearInterval(intervalId);
    intervalId = null;
    lastExecutionTime = null;
    scrapingTabId = null;
  }
}

function updateLastFetchedId(newId) {
  if (currentSettings && newId > currentSettings.lastItemId) {
    currentSettings.lastItemId = newId;
    
    // Save to storage
    chrome.storage.local.set({ lastItemId: newId }, () => {
      logger.background('Updated last fetched ID to:', newId);
      
      // Notify popup to update UI
      chrome.runtime.sendMessage({
        action: 'updateLastFetchedId',
        lastItemId: newId
      });
    });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.background('Message received:', request);
  
  if (request.action === 'startScraping') {
    startScraping(request.settings);
    sendResponse({ status: 'Scraping started' });
  } else if (request.action === 'stopScraping') {
    stopScraping();
    sendResponse({ status: 'Scraping stopped' });
  } else if (request.action === 'showNotification') {
    showNotification(request.deal);
    updateLastFetchedId(request.deal.id);
    sendResponse({ status: 'Notification shown' });
  }
  
  return true;
});