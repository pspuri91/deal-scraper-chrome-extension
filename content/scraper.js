// Queue management variables
if (typeof window.clickQueue === 'undefined') {
    window.clickQueue = [];
    window.isProcessingQueue = false;
}

// Content script logger
if (typeof window.contentLogger === 'undefined') {
    window.contentLogger = {
        log: (message, data) => {
            console.log(`[Content] ${message}`, data !== undefined ? data : '');
        },
        error: (message, error) => {
            console.error(`[Content] Error: ${message}`, error);
        }
    };
}

// Main scraping function
function scrapeContent(lastItemId) {
    window.contentLogger.log(`Starting scrape with lastItemId: ${lastItemId}`);
    
    // First check if we have a stored queue to process
    const storedQueue = localStorage.getItem('dealClickQueue');
    if (storedQueue) {
        try {
            window.clickQueue = JSON.parse(storedQueue);
            if (window.clickQueue.length > 0) {
                window.contentLogger.log('Found stored queue, processing first:', window.clickQueue);
                processClickQueue();
                return;
            }
        } catch (error) {
            window.contentLogger.error('Error parsing stored queue:', error);
            localStorage.removeItem('dealClickQueue');
        }
    }

    // Find Active Deals section
    const activeDealsHeaders = Array.from(document.getElementsByTagName('h3'))
        .filter(h3 => h3.textContent.trim() === 'Active Deals');

    if (!activeDealsHeaders.length) {
        window.contentLogger.log('No Active Deals section found');
        return;
    }

    // Find the cards container
    const parentDiv = activeDealsHeaders[0].nextElementSibling;
    if (!parentDiv) {
        window.contentLogger.log('No deals container found');
        return;
    }

    // Process each card
    const cardDivs = parentDiv.querySelectorAll('div.group');
    window.contentLogger.log(`Found ${cardDivs.length} cards to process`);

    cardDivs.forEach(card => {
        try {
            const itemIdInput = card.querySelector('input[type="number"]');
            if (!itemIdInput) return;

            const itemId = parseInt(itemIdInput.name.split('_')[0], 10);
            const maxQty = itemIdInput.max ? parseInt(itemIdInput.max) : -1;
            if (isNaN(itemId) || itemId <= lastItemId) return;

            const itemName = card.querySelector('h3 > div')?.textContent.trim();
            const storeNameElement = Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('From:'));
            const itemStoreName = storeNameElement?.textContent.replace('From:', '').trim();
            
            if (!itemStoreName?.includes('Amazon') || itemStoreName.includes('Business')) return;

            const priceElement = Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('Price:'));
            const itemPrice = priceElement?.textContent.replace('Price:', '').replace('$', '').trim();

            const buttonElement = itemIdInput.closest('div').parentElement.querySelector('button[wire\\:click]');
            if (!buttonElement) return;

            window.clickQueue.push({
                id: itemId,
                name: itemName,
                store: itemStoreName,
                price: itemPrice,
                max: maxQty
            });

            window.contentLogger.log('Added to queue:', { itemId, itemName });
        } catch (error) {
            window.contentLogger.error('Error processing card:', error);
        }
    });

    // Save queue and start processing
    if (window.clickQueue.length > 0) {
        localStorage.setItem('dealClickQueue', JSON.stringify(window.clickQueue));
        window.contentLogger.log('Starting queue processing');
        processClickQueue();
    } else {
        window.contentLogger.log('No items to process, will refresh in 10s');
        setTimeout(() => location.reload(), 10000);
    }
}

async function processClickQueue() {
    if (window.isProcessingQueue || window.clickQueue.length === 0) {
        if (window.clickQueue.length === 0) {
            window.contentLogger.log('Queue empty, cleaning up...');
            localStorage.removeItem('dealClickQueue');
            localStorage.removeItem('processingItemId');
            localStorage.removeItem('currentProcessingItem');
            setTimeout(() => location.reload(), 10000);
        }
        return;
    }

    window.isProcessingQueue = true;
    const item = window.clickQueue[0];
    
    try {
        window.contentLogger.log('Processing queue item:', item);
        
        // Find and validate elements
        const input = document.querySelector(`input[name="${item.id}_amount"]`);
        if (!input) {
            throw new Error(`Input not found for item ${item.id}`);
        }

        const button = input.closest('div').parentElement.querySelector('button[wire\\:click]');
        if (!button) {
            throw new Error(`Button not found for item ${item.id}`);
        }

        // Important: Store state BEFORE any actions
        localStorage.setItem('processingItemId', item.id.toString());
        localStorage.setItem('currentProcessingItem', JSON.stringify(item));
        localStorage.setItem('queueState', 'processing');

        // Set input value
        input.value = '1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // Send notification and process
        chrome.runtime.sendMessage({
            action: 'showNotification',
            deal: item
        }, () => {
            // Update queue in localStorage before clicking
            window.clickQueue.shift();
            localStorage.setItem('dealClickQueue', JSON.stringify(window.clickQueue));
            
            // Add a small delay before clicking to ensure state is saved
            setTimeout(() => {
                window.contentLogger.log('Clicking button for:', item.id);
                button.click();

                // Update the last fetched ID
                chrome.runtime.sendMessage({
                    action: 'updateLastFetchedId',
                    lastItemId: item.id
                });
            }, 500);
        });
    } catch (error) {
        window.contentLogger.error('Error processing item:', error);
        // Handle error and continue with next item
        window.clickQueue.shift();
        localStorage.setItem('dealClickQueue', JSON.stringify(window.clickQueue));
        localStorage.removeItem('processingItemId');
        localStorage.removeItem('currentProcessingItem');
        localStorage.removeItem('queueState');
        window.isProcessingQueue = false;
        processClickQueue();
    }
}

// Modify the DOMContentLoaded handler to be more aggressive about queue processing
document.addEventListener('DOMContentLoaded', () => {
    window.contentLogger.log('Page loaded, checking queue state...');
    
    const queueState = localStorage.getItem('queueState');
    const processingItemId = localStorage.getItem('processingItemId');
    const currentProcessingItem = localStorage.getItem('currentProcessingItem');
    
    if (queueState === 'processing' && processingItemId && currentProcessingItem) {
        window.contentLogger.log('Previous item processed:', processingItemId);
        // Clear processing state
        localStorage.removeItem('processingItemId');
        localStorage.removeItem('currentProcessingItem');
        localStorage.removeItem('queueState');
    }

    // Function to handle queue processing
    const handleQueue = () => {
        const storedQueue = localStorage.getItem('dealClickQueue');
        if (!storedQueue) {
            window.contentLogger.log('No stored queue found');
            return;
        }

        try {
            window.clickQueue = JSON.parse(storedQueue);
            window.contentLogger.log('Restored queue with items:', window.clickQueue.length);
            
            if (window.clickQueue.length > 0) {
                window.contentLogger.log('Processing next item in queue');
                window.isProcessingQueue = false;
                processClickQueue();
            } else {
                window.contentLogger.log('Queue empty, will refresh');
                setTimeout(() => location.reload(), 10000);
            }
        } catch (error) {
            window.contentLogger.error('Error handling queue:', error);
            localStorage.removeItem('dealClickQueue');
            localStorage.removeItem('processingItemId');
            localStorage.removeItem('currentProcessingItem');
            localStorage.removeItem('queueState');
        }
    };

    // Try processing queue multiple times to ensure it runs
    setTimeout(handleQueue, 1000);  // First attempt
    setTimeout(handleQueue, 2000);  // Second attempt if first fails
    setTimeout(handleQueue, 3000);  // Third attempt if previous fail
});

// Make functions available globally
window.scrapeContent = scrapeContent;

// Handle notification sound
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playNotificationSound') {
        const audio = new Audio(chrome.runtime.getURL('notification.mp3'));
        audio.play()
            .then(() => window.contentLogger.log('Played notification sound'))
            .catch(error => window.contentLogger.error('Error playing sound:', error));
    }
});