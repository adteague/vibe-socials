// File path: /audit.js
document.addEventListener('DOMContentLoaded', async () => {
  let currentEntries = [];
  let allEntries = [];
  let currentLimit = 50;

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearch');
  const statusFilter = document.getElementById('statusFilter');
  const platformFilter = document.getElementById('platformFilter');
  const providerFilter = document.getElementById('providerFilter');
  const timeFilter = document.getElementById('timeFilter');
  const loadMoreBtn = document.getElementById('loadMore');
  const clearLogBtn = document.getElementById('clearLog');
  const auditEntriesDiv = document.getElementById('auditEntries');
  const summaryStatsDiv = document.getElementById('summaryStats');

  // Load initial data
  await loadAuditData();

  // Search functionality
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  searchInput.addEventListener('input', debounce(performSearch, 300));

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    resetFilters();
    performSearch();
  });

  // Filter controls
  statusFilter.addEventListener('change', performSearch);
  platformFilter.addEventListener('change', performSearch);
  providerFilter.addEventListener('change', performSearch);
  timeFilter.addEventListener('change', performSearch);

  // Load more entries
  loadMoreBtn.addEventListener('click', () => {
    currentLimit += 50;
    loadMoreBtn.textContent = `📄 Load More (${currentLimit})`;
    performSearch();
  });

  // Clear audit log
  clearLogBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all audit log data? This cannot be undone.')) {
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'clearAuditLog' }, (response) => {
            if (response.success) resolve();
            else reject(new Error(response.error));
          });
        });
        
        allEntries = [];
        currentEntries = [];
        displayEntries([]);
        updateSummaryStats([]);
        showNotification('Audit log cleared successfully!');
      } catch (error) {
        alert(`Failed to clear audit log: ${error.message}`);
      }
    }
  });

  async function loadAuditData() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'getAuditLog', searchQuery: '', limit: 1000 },
          (response) => {
            if (response.success) resolve(response.results);
            else reject(new Error(response.error));
          }
        );
      });

      allEntries = response;
      performSearch(); // Initial display
    } catch (error) {
      auditEntriesDiv.innerHTML = `
        <div class="empty-state">
          <h3>❌ Failed to load audit log</h3>
          <p>${error.message}</p>
          <p>Browse social media to start generating audit data. Analytics are now computed directly from the audit log!</p>
        </div>
      `;
    }
  }

  function performSearch() {
    let filteredEntries = [...allEntries];

    // Apply text search
    const searchQuery = searchInput.value.trim();
    if (searchQuery) {
      filteredEntries = fuzzySearchEntries(filteredEntries, searchQuery);
    }

    // Apply filters
    if (statusFilter.value) {
      filteredEntries = filteredEntries.filter(entry => {
        if (statusFilter.value === 'filtered') return entry.response && !entry.response.shouldShow;
        if (statusFilter.value === 'allowed') return entry.response && entry.response.shouldShow;
        if (statusFilter.value === 'error') return !!entry.error;
        return true;
      });
    }

    if (platformFilter.value) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.platform === platformFilter.value
      );
    }

    if (providerFilter.value) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.apiProvider === providerFilter.value
      );
    }

    if (timeFilter.value) {
      const now = new Date();
      const filterTime = new Date(now);
      
      switch (timeFilter.value) {
        case '1h':
          filterTime.setHours(now.getHours() - 1);
          break;
        case '24h':
          filterTime.setDate(now.getDate() - 1);
          break;
        case '7d':
          filterTime.setDate(now.getDate() - 7);
          break;
      }

      filteredEntries = filteredEntries.filter(entry => 
        new Date(entry.timestamp) >= filterTime
      );
    }

    currentEntries = filteredEntries.slice(0, currentLimit);
    displayEntries(currentEntries);
    updateSummaryStats(filteredEntries);
  }

  function fuzzySearchEntries(entries, query) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return entries.filter(entry => {
      const searchableText = [
        entry.content,
        entry.poster,
        entry.platform,
        entry.response?.reason || '',
        entry.error || '',
        entry.apiProvider
      ].join(' ').toLowerCase();

      return searchTerms.every(term => 
        searchableText.includes(term) || fuzzyMatch(searchableText, term)
      );
    });
  }

  function fuzzyMatch(text, term) {
    // Allow 1 character difference per 4 characters in term
    const maxErrors = Math.floor(term.length / 4);
    const regex = new RegExp(term.split('').join('.*?'), 'i');
    return regex.test(text);
  }

  function displayEntries(entries) {
    if (entries.length === 0) {
      auditEntriesDiv.innerHTML = `
        <div class="empty-state">
          <h3>🔍 No audit entries found</h3>
          <p>Try adjusting your search terms or filters, or browse social media to generate audit data.</p>
        </div>
      `;
      return;
    }

    auditEntriesDiv.innerHTML = entries.map(entry => createEntryHTML(entry)).join('');
    
    // Add expand/collapse functionality
    document.querySelectorAll('.expandable').forEach(element => {
      element.addEventListener('click', () => {
        const targetId = element.dataset.target;
        const target = document.getElementById(targetId);
        target.classList.toggle('show');
        
        const icon = element.querySelector('.expand-icon');
        icon.textContent = target.classList.contains('show') ? '▼' : '▶';
      });
    });
  }

  function createEntryHTML(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const isFiltered = entry.response && !entry.response.shouldShow;
    const isError = !!entry.error;
    
    let statusClass, statusText, statusIcon;
    
    if (isError) {
      statusClass = 'error';
      statusText = 'Analysis Error';
      statusIcon = '⚠️';
    } else if (isFiltered) {
      statusClass = 'filtered';
      statusText = 'Content Filtered';
      statusIcon = '🚫';
    } else {
      statusClass = 'allowed';
      statusText = 'Content Allowed';
      statusIcon = '✅';
    }

    const entryId = `entry-${entry.id}`;
    const promptId = `prompt-${entry.id}`;

    return `
      <div class="audit-entry ${statusClass}">
        <div class="entry-header">
          <div class="entry-status ${statusClass}">
            ${statusIcon} ${statusText}
          </div>
          <div class="entry-meta">
            <span>📅 ${timestamp}</span>
            <span>👤 @${entry.poster}</span>
            <span>🌐 ${entry.platform}</span>
            <span>🤖 ${entry.apiProvider}</span>
            <span>🧠 ${entry.aiModel || 'N/A'}</span>
            <span>⚡ ${entry.filterStrength}</span>
          </div>
        </div>

        <div class="content-section">
          <div class="section-title">📝 Post Content</div>
          <div class="content-text">${escapeHtml(entry.content)}</div>
        </div>

        ${entry.response ? `
          <div class="response-details">
            <div class="response-item">
              <div class="response-value">${entry.response.score || 'N/A'}/10</div>
              <div class="response-label">Positivity Score</div>
            </div>
            <div class="response-item">
              <div class="response-value">${entry.response.shouldShow ? 'Yes' : 'No'}</div>
              <div class="response-label">Should Show</div>
            </div>
            <div class="response-item">
              <div class="response-value" style="font-size: 12px;">${escapeHtml(entry.response.reason || 'No reason')}</div>
              <div class="response-label">AI Reasoning</div>
            </div>
          </div>
        ` : ''}

        ${entry.error ? `
          <div class="content-section">
            <div class="section-title">❌ Error Details</div>
            <div class="content-text" style="color: #fca5a5;">${escapeHtml(entry.error)}</div>
          </div>
        ` : ''}

        <div class="expandable" data-target="${promptId}">
          <span class="expand-icon">▶</span> View Full Analysis Prompt
        </div>
        <div class="expanded-content" id="${promptId}">
          <div class="section-title">🎯 Analysis Prompt Sent to AI</div>
          <div class="prompt-text">${escapeHtml(entry.prompt)}</div>
        </div>
      </div>
    `;
  }

  function updateSummaryStats(entries) {
    const totalEntries = entries.length;
    const filteredCount = entries.filter(e => e.response && !e.response.shouldShow).length;
    const allowedCount = entries.filter(e => e.response && e.response.shouldShow).length;
    const errorCount = entries.filter(e => !!e.error).length;
    const avgScore = entries.length > 0 ? 
      Math.round((entries.filter(e => e.response).reduce((sum, e) => sum + (e.response.score || 0), 0) / 
      entries.filter(e => e.response).length) * 10) / 10 : 0;

    summaryStatsDiv.innerHTML = `
      <div class="summary-item">
        <div class="summary-value">${totalEntries}</div>
        <div class="summary-label">Total Entries</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${allowedCount}</div>
        <div class="summary-label">Allowed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${filteredCount}</div>
        <div class="summary-label">Filtered</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${errorCount}</div>
        <div class="summary-label">Errors</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${avgScore}</div>
        <div class="summary-label">Avg Score</div>
      </div>
    `;
  }

  function resetFilters() {
    statusFilter.value = '';
    platformFilter.value = '';
    providerFilter.value = '';
    timeFilter.value = '';
    currentLimit = 50;
    loadMoreBtn.textContent = '📄 Load More (50)';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(34, 197, 94, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 600;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
});