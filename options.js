// File path: /options.js
document.addEventListener('DOMContentLoaded', async () => {
  const apiProvider = document.getElementById('apiProvider');
  const aiModel = document.getElementById('aiModel');
  const modelSelection = document.getElementById('modelSelection');
  const apiKey = document.getElementById('apiKey');
  const filterStrength = document.getElementById('filterStrength');
  const customPrompt = document.getElementById('customPrompt');
  const saveBtn = document.getElementById('saveSettings');
  const testBtn = document.getElementById('testApi');
  const statusDiv = document.getElementById('statusMessage');
  const showDefaultPromptBtn = document.getElementById('showDefaultPrompt');
  const resetPromptBtn = document.getElementById('resetPrompt');
  const defaultPromptDisplay = document.getElementById('defaultPromptDisplay');
  const defaultPromptText = document.getElementById('defaultPromptText');
  const promptPreview = document.getElementById('promptPreview');
  const promptPreviewText = document.getElementById('promptPreviewText');
  const activePromptText = document.getElementById('activePromptText');

  let defaultPrompt = '';

  // Load default prompt from background script
  chrome.runtime.sendMessage({ action: 'getDefaultPrompt' }, (response) => {
    if (response && response.defaultPrompt) {
      defaultPrompt = response.defaultPrompt;
      defaultPromptText.textContent = defaultPrompt;
    }
  });

  // Load saved settings
  const settings = await chrome.storage.sync.get([
    'apiProvider', 'aiModel', 'apiKey', 'filterStrength', 'customPrompt'
  ]);

  apiProvider.value = settings.apiProvider || 'openai';
  aiModel.value = settings.aiModel || 'gpt-4o-mini';
  apiKey.value = settings.apiKey || '';
  filterStrength.value = settings.filterStrength || 'medium';
  customPrompt.value = settings.customPrompt || '';

  // Show/hide model selection based on provider
  updateModelSelection();
  
  // Initialize displays
  updateActivePrompt();
  updatePromptPreview();

  // Provider change handler
  apiProvider.addEventListener('change', () => {
    updateModelSelection();
    updateActivePrompt();
  });

  // Model change handler  
  aiModel.addEventListener('change', () => {
    updateActivePrompt();
  });

  function updateModelSelection() {
    if (apiProvider.value === 'openai') {
      modelSelection.style.display = 'block';
      // Set OpenAI models
      aiModel.innerHTML = `
        <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
        <option value="gpt-4o">GPT-4o (Balanced)</option>
        <option value="gpt-4-turbo">GPT-4 Turbo (High Quality)</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
      `;
    } else if (apiProvider.value === 'grok') {
      modelSelection.style.display = 'block';
      // Set Grok models
      aiModel.innerHTML = `
        <option value="grok-beta">Grok Beta</option>
      `;
    } else {
      modelSelection.style.display = 'none';
    }
  }

  // Prompt visibility controls
  showDefaultPromptBtn.addEventListener('click', () => {
    const isVisible = defaultPromptDisplay.style.display !== 'none';
    defaultPromptDisplay.style.display = isVisible ? 'none' : 'block';
    showDefaultPromptBtn.textContent = isVisible ? '👁️ View Default Prompt' : '🙈 Hide Default Prompt';
  });

  resetPromptBtn.addEventListener('click', () => {
    if (confirm('Reset to default analysis prompt? This will clear your custom prompt.')) {
      customPrompt.value = '';
      updatePromptPreview();
      updateActivePrompt();
      showStatus('Prompt reset to default!', 'success');
    }
  });

  // Add prompt preview functionality
  customPrompt.addEventListener('input', () => {
    updatePromptPreview();
    updateActivePrompt();
  });

  filterStrength.addEventListener('change', () => {
    updatePromptPreview();
    updateActivePrompt();
  });

  function updatePromptPreview() {
    const promptPreview = document.getElementById('promptPreview');
    const promptPreviewText = document.getElementById('promptPreviewText');
    
    if (customPrompt.value.trim()) {
      const preview = customPrompt.value
        .replace('{{CONTENT}}', '"This is a sample post to show how your prompt will look with real content."')
        .replace('{{FILTER_STRENGTH}}', filterStrength.value);
      
      promptPreviewText.textContent = preview;
      promptPreview.style.display = 'block';
    } else {
      // Show default prompt preview
      const strengthDescriptions = {
        low: 'only filter extremely negative content like hate speech, threats, or severe harassment',
        medium: 'filter negative content including arguments, complaints, doom scrolling content, or generally pessimistic posts',
        high: 'only allow highly positive, uplifting, educational, or constructive content'
      };

      const defaultPreview = `Analyze this social media content for positive mental impact. Filter strength: ${filterStrength.value} - ${strengthDescriptions[filterStrength.value]}.

Content: "This is a sample post to show how your prompt will look with real content."

Respond with only this JSON format:
{
  "shouldShow": true/false,
  "score": 1-10,
  "reason": "brief explanation"
}

Score 1-10 where 10 is most positive mental impact. Use shouldShow: false to filter content based on the ${filterStrength.value} filter strength.`;

      promptPreviewText.textContent = defaultPreview;
      promptPreview.style.display = 'block';
    }
  }

  // Initialize prompt preview
  updatePromptPreview();

  function updateActivePrompt() {
    const strengthDescriptions = {
      low: 'only filter extremely negative content like hate speech, threats, or severe harassment',
      medium: 'filter negative content including arguments, complaints, doom scrolling content, or generally pessimistic posts',
      high: 'only allow highly positive, uplifting, educational, or constructive content'
    };

    let activePrompt;
    
    if (customPrompt.value.trim()) {
      // Show custom prompt with sample content
      activePrompt = customPrompt.value
        .replace('{{CONTENT}}', '"Example: Just had the most amazing coffee this morning! ☕️"')
        .replace('{{FILTER_STRENGTH}}', filterStrength.value);
    } else {
      // Show default prompt with sample content
      activePrompt = `Analyze this social media content for positive mental impact. Filter strength: ${filterStrength.value} - ${strengthDescriptions[filterStrength.value]}.

Content: "Example: Just had the most amazing coffee this morning! ☕️"

Respond with only this JSON format:
{
  "shouldShow": true/false,
  "score": 1-10,
  "reason": "brief explanation"
}

Score 1-10 where 10 is most positive mental impact. Use shouldShow: false to filter content based on the ${filterStrength.value} filter strength.`;
    }

    activePromptText.textContent = activePrompt;
  }

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      apiProvider: apiProvider.value,
      aiModel: aiModel.value,
      apiKey: apiKey.value,
      filterStrength: filterStrength.value,
      customPrompt: customPrompt.value,
      enabled: true
    };

    await chrome.storage.sync.set(newSettings);
    showStatus('Settings saved successfully!', 'success');
  });

  // Test API connection
  testBtn.addEventListener('click', async () => {
    const testContent = "This is a test message to verify API connectivity.";
    
    showStatus('Testing API connection...', 'info');
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'analyzeContent', content: testContent },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response.success) {
              resolve(response.result);
            } else {
              reject(new Error(response.error));
            }
          }
        );
      });

      showStatus(`✅ API test successful! Score: ${response.score}/10`, 'success');
    } catch (error) {
      showStatus(`❌ API test failed: ${error.message}`, 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 3000);
  }
});