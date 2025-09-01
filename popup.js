// File path: /popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const enabledSwitch = document.getElementById('enabledSwitch');
  const filterStrength = document.getElementById('filterStrength');
  const statsDiv = document.getElementById('stats');
  const promptStatus = document.getElementById('promptStatus');
  const openOptionsBtn = document.getElementById('openOptions');
  const posterAnalyticsBtn = document.getElementById('posterAnalytics');
  const auditLogBtn = document.getElementById('auditLog');

  // Check if all elements exist before adding listeners
  if (!enabledSwitch || !filterStrength || !statsDiv || !promptStatus || 
      !openOptionsBtn || !posterAnalyticsBtn || !auditLogBtn) {
    console.error('Some popup elements not found:', JSON.stringify({
      enabledSwitch: !!enabledSwitch,
      filterStrength: !!filterStrength,
      statsDiv: !!statsDiv,
      promptStatus: !!promptStatus,
      openOptionsBtn: !!openOptionsBtn,
      posterAnalyticsBtn: !!posterAnalyticsBtn,
      auditLogBtn: !!auditLogBtn
    }, null, 2));
    return;
  }

  // Load current settings
  const settings = await chrome.storage.sync.get([
    'enabled', 'filterStrength', 'customPrompt'
  ]);

  // Set UI state
  if (settings.enabled !== false) {
    enabledSwitch.classList.add('active');
  }
  filterStrength.value = settings.filterStrength || 'medium';

  // Update prompt status
  updatePromptStatus(settings);

  function updatePromptStatus(settings) {
    const isCustom = settings.customPrompt && settings.customPrompt.trim();
    promptStatus.innerHTML = isCustom 
      ? '🎯 Using Custom Analysis Prompt'
      : '📝 Using Default Analysis Prompt';
  }

  // Update stats
  updateStats();

  // Event listeners with null checks
  if (enabledSwitch) {
    enabledSwitch.addEventListener('click', () => {
      const isEnabled = enabledSwitch.classList.toggle('active');
      chrome.storage.sync.set({ enabled: isEnabled });
    });
  }

  if (filterStrength) {
    filterStrength.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterStrength: e.target.value });
      // Update prompt status when filter strength changes
      chrome.storage.sync.get(['customPrompt'], (settings) => {
        updatePromptStatus({...settings, filterStrength: e.target.value});
      });
    });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (posterAnalyticsBtn) {
    posterAnalyticsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('analytics.html') });
    });
  }

  if (auditLogBtn) {
    auditLogBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('audit.html') });
    });
  }

  async function updateStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
      
      if (response) {
        statsDiv.innerHTML = `
          📊 Session Stats<br>
          Analyzed: ${response.analyzed}<br>
          Filtered: ${response.filtered}
        `;
      }
    } catch (error) {
      statsDiv.innerHTML = '📊 Stats unavailable on this page';
    }
  }

  function updatePromptStatus(settings) {
    const isCustom = settings.customPrompt && settings.customPrompt.trim();
    promptStatus.innerHTML = isCustom 
      ? '🎯 Using Custom Prompt'
      : '📝 Using Default Prompt';
  }
});