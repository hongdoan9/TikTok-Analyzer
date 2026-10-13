// Background Service Worker for TikTok Analytics Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TikTok Analytics] Extension installed successfully.');
});

// Listen for messages from content scripts, popup, or dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_DASHBOARD') {
    const url = chrome.runtime.getURL('dashboard.html' + (request.query ? '?' + request.query : ''));
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'SYNC_TO_GOOGLE_SHEETS') {
    // Send data to Google Apps Script Web App without CORS issue
    fetch(request.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(request.payload)
    })
    .then(res => res.json().catch(() => ({ status: 'success', text: 'Sent to sheet' })))
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  }
});
