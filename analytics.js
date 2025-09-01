// File path: /analytics.js
document.addEventListener('DOMContentLoaded', async () => {
  let currentPlatform = 'unknown';
  let posterData = null;

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
    });
  });

  // Reset stats button
  document.getElementById('resetStats').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all poster statistics? This will clear the entire audit log and cannot be undone.')) {
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'clearAuditLog' }, (response) => {
            if (response.success) resolve();
            else reject(new Error(response.error));
          });
        });
        
        posterData = { all: [], toxic: [], healthy: [], totalPosters: 0 };
        displaySummary(posterData);
        displayPosterLists(posterData);
        showNotification('All audit data and poster statistics cleared!');
      } catch (error) {
        alert(`Failed to clear data: ${error.message}`);
      }
    }
  });

  // Load poster analytics
  await loadPosterAnalytics();

  async function loadPosterAnalytics() {
    try {
      // Get current platform info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const hostname = new URL(tab.url).hostname;
      currentPlatform = detectPlatform(hostname);

      // Get poster analytics from background script (computed from audit log)
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getPosterAnalytics' }, (response) => {
          if (response.success) resolve(response.results);
          else reject(new Error(response.error));
        });
      });

      posterData = response;
      displaySummary(response);
      displayPosterLists(response);
    } catch (error) {
      document.getElementById('summary').innerHTML = `
        <div style="text-align: center; padding: 20px;">
          📊 Loading poster analytics from audit log...<br>
          <small style="opacity: 0.7; margin-top: 10px; display: block;">
            ${error.message}<br>
            Browse social media to generate analytics data
          </small>
        </div>
      `;
    }
  }

  function detectPlatform(hostname) {
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('reddit.com')) return 'reddit';
    return 'unknown';
  }

  function displaySummary(data) {
    const summary = document.getElementById('summary');
    const totalPosts = data.all.reduce((sum, poster) => sum + poster.postCount, 0);
    const totalFiltered = data.all.reduce((sum, poster) => sum + poster.filtered, 0);
    const avgScore = data.all.length > 0 ? 
      Math.round((data.all.reduce((sum, poster) => sum + poster.averageScore, 0) / data.all.length) * 10) / 10 : 0;

    summary.innerHTML = `
      <h3 style="margin: 0 0 15px 0;">📈 Analytics Summary (From Audit Log)</h3>
      <div class="summary-grid">
        <div class="stat-item">
          <div class="stat-value">${data.totalPosters}</div>
          <div class="stat-label">Tracked Posters</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${totalPosts}</div>
          <div class="stat-label">Total Posts</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${totalFiltered}</div>
          <div class="stat-label">Filtered Posts</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgScore}</div>
          <div class="stat-label">Average Score</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.toxic.length}</div>
          <div class="stat-label">Toxic Posters</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.healthy.length}</div>
          <div class="stat-label">Healthy Posters</div>
        </div>
      </div>
    `;
  }

  function displayPosterLists(data) {
    displayPosters('toxic-posters', data.toxic, 'toxic');
    displayPosters('healthy-posters', data.healthy, 'healthy');
    displayPosters('all-posters', data.all, 'neutral');
  }

  function displayPosters(containerId, posters, type) {
    const container = document.getElementById(containerId);
    
    if (posters.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No ${type} posters found yet</h3>
          <p>Browse social media to build up analytics data!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posters.map(poster => createPosterCard(poster, type)).join('');
  }

  function createPosterCard(poster, type) {
    const filteredPercentage = Math.round((poster.filtered / poster.postCount) * 100);
    const allowedPercentage = Math.round((poster.allowed / poster.postCount) * 100);
    
    const progressBarClass = type === 'toxic' ? 'toxic' : 'healthy';
    const progressWidth = type === 'toxic' ? filteredPercentage : allowedPercentage;

    // Use the platform from poster data or fall back to detected platform
    const posterPlatform = poster.platform || currentPlatform;
    const platformUrls = {
      twitter: `https://twitter.com/${poster.username}`,
      facebook: `https://facebook.com/${poster.username}`,
      instagram: `https://instagram.com/${poster.username}`,
      linkedin: `https://linkedin.com/in/${poster.username}`,
      reddit: `https://reddit.com/user/${poster.username}`
    };

    const profileUrl = platformUrls[posterPlatform] || '#';
    const platformName = posterPlatform.charAt(0).toUpperCase() + posterPlatform.slice(1);

    return `
      <div class="poster-card ${type}">
        <div class="poster-name">@${poster.username}</div>
        
        <div class="poster-stats">
          <div class="stat-item">
            <div class="stat-value">${poster.postCount}</div>
            <div class="stat-label">Total Posts</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${poster.averageScore}/10</div>
            <div class="stat-label">Avg Score</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${poster.allowed}</div>
            <div class="stat-label">Shown</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${poster.filtered}</div>
            <div class="stat-label">Filtered</div>
          </div>
        </div>

        <div class="progress-bar">
          <div class="progress-fill ${progressBarClass}" style="width: ${progressWidth}%"></div>
        </div>
        <div style="font-size: 11px; opacity: 0.8; text-align: center; margin-top: 5px;">
          ${type === 'toxic' ? `${filteredPercentage}% filtered` : `${allowedPercentage}% positive`}
        </div>

        <div style="font-size: 11px; opacity: 0.7; text-align: center; margin: 5px 0;">
          Platform: ${platformName}
        </div>

        <div class="action-buttons">
          <button class="action-btn profile-btn" onclick="openProfile('${profileUrl}')">
            👤 Profile
          </button>
          <button class="action-btn mute-btn" onclick="copyUsername('@${poster.username}')">
            🔇 Copy @
          </button>
          <button class="action-btn block-btn" onclick="showBlockInstructions('${poster.username}', '${posterPlatform}')">
            🚫 Block Info
          </button>
        </div>
      </div>
    `;
  }

  // Global functions for button actions
  window.openProfile = function(url) {
    if (url !== '#') {
      chrome.tabs.create({ url });
    }
  };

  window.copyUsername = function(username) {
    navigator.clipboard.writeText(username).then(() => {
      showNotification('Username copied to clipboard!');
    });
  };

  window.showBlockInstructions = function(username, platform) {
    const instructions = {
      twitter: `To block @${username} on Twitter/X:\n1. Go to their profile\n2. Click the three dots menu\n3. Select "Block @${username}"`,
      facebook: `To block ${username} on Facebook:\n1. Go to their profile\n2. Click the three dots menu\n3. Select "Block"`,
      instagram: `To block @${username} on Instagram:\n1. Go to their profile\n2. Click "Following" or "Follow"\n3. Select "Block"`,
      linkedin: `To block ${username} on LinkedIn:\n1. Go to their profile\n2. Click "More" button\n3. Select "Block or report"`,
      reddit: `To block u/${username} on Reddit:\n1. Go to their profile\n2. Click "More Options"\n3. Select "Block User"`
    };

    alert(instructions[platform] || `To block this user, visit their profile and look for block/mute options.`);
  };

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
    }, 2000);
  }
});