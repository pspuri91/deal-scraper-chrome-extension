function scrapeContent(lastItemId) {
  console.log('[Content] Starting content script with lastItemId:', lastItemId);
  
  // Find the "Active Deals" section
  const activeDealsHeaders = Array.from(document.getElementsByTagName('h3'))
    .filter(h3 => h3.textContent.includes('Active Deals'));

  console.log('[Content] Found Active Deals headers:', activeDealsHeaders.length);

  if (activeDealsHeaders.length === 0) {
    console.log('[Content] No Active Deals section found');
    return;
  }

  // Find the closest parent div with wire:initial-data
  const parentDiv = activeDealsHeaders[0].closest('div[wire\\:initial-data]');
  console.log('[Content] Found parent div:', !!parentDiv);
  
  if (!parentDiv) {
    console.log('[Content] No parent div with wire:initial-data found');
    return;
  }

  // Get and decode the wire:initial-data attribute
  const encodedData = parentDiv.getAttribute('wire:initial-data');
  console.log('[Content] Retrieved encoded data:', encodedData ? 'yes' : 'no');
  
  const decodedData = decodeHTMLEntities(encodedData);
  console.log('[Content] Decoded data length:', decodedData.length);
  
  try {
    const dataObj = JSON.parse(decodedData);
    console.log('[Content] Successfully parsed JSON data');
    
    const commitments = dataObj.serverMemo.data.commitments;
    console.log('[Content] Found commitments:', Object.keys(commitments).length);

    // Process commitments
    Object.entries(commitments).forEach(([key, value]) => {
      const itemId = parseInt(key, 10);
      console.log('[Content] Processing commitment:', { key, itemId, value });
      
      if (itemId > lastItemId && value.editing === true && value.max > 0) {
        console.log('[Content] Found matching deal:', { itemId, value });
        chrome.runtime.sendMessage({
          action: 'showNotification',
          deal: {
            id: itemId,
            ...value
          }
        }, (response) => {
          console.log('[Content] Notification message response:', response);
        });
      }
    });
  } catch (error) {
    console.error('[Content] Error processing data:', error);
  }
}

function decodeHTMLEntities(text) {
  console.log('[Content] Decoding HTML entities');
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}