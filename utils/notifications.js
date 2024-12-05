import { logger } from './logger.js';

export function showNotification(deal) {
  logger.background('Creating notification for deal:', deal);
  
  // First check if we have notification permission
  chrome.notifications.getPermissionLevel((permissionLevel) => {
    logger.background('Notification permission level:', permissionLevel);
    
    const message = `
    Deal ID: ${deal.id}
  Price: ${deal.price}
  Store: ${deal.store}
  Max: ${deal.max}
    `.trim();

    try {
      logger.background('Attempting to create notification with message:', message);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon48.png'),  // Make sure we get the full URL
        title: deal.name,
        message,
        priority: 2,
        requireInteraction: true  // Make notification persist
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          logger.error('Background', 'Error creating notification:', chrome.runtime.lastError);
          return;
        }
        logger.background('Notification created successfully with ID:', notificationId);
        
        // Send message to content script to play sound
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'playNotificationSound'
            });
          }
        });
      });
    } catch (error) {
      logger.error('Background', 'Failed to create notification:', error);
    }
  });
}