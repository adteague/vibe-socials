// File path: /content.js
// Content script that runs on social media pages
class SocialMediaFilter {
  constructor() {
    this.platform = this.detectPlatform();
    this.processedPosts = new Set();
    this.observer = null;
    this.isEnabled = false;
    this.stats = { filtered: 0, analyzed: 0 };
    
    this.init();
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('facebook.com')) return 'facebook';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('reddit.com')) return 'reddit';
    return 'unknown';
  }

  async init() {
    // Check if extension is enabled
    const settings = await chrome.storage.sync.get(['enabled']);
    this.isEnabled = settings.enabled !== false; // Default to true

    if (!this.isEnabled) return;

    this.setupObserver();
    this.processExistingContent();
    this.addStatusIndicator();
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getStats') {
        sendResponse(this.stats);
      }
    });
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              this.processNewContent(node);
            }
          });
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processExistingContent() {
    const posts = this.findPosts(document);
    posts.forEach(post => this.processPost(post));
  }

  processNewContent(element) {
    const posts = this.findPosts(element);
    posts.forEach(post => this.processPost(post));
  }

  findPosts(container) {
    const selectors = {
      twitter: '[data-testid="tweet"]',
      facebook: '[role="article"]',
      instagram: 'article',
      linkedin: '.feed-shared-update-v2',
      reddit: '[data-testid="post-container"]'
    };

    const selector = selectors[this.platform];
    if (!selector) return [];

    return Array.from(container.querySelectorAll ? container.querySelectorAll(selector) : []);
  }

  async processPost(postElement) {
    // Simple duplicate check for this session (will be more thorough in background)
    const postId = this.getPostId(postElement);
    if (this.processedPosts.has(postId)) return;
    
    this.processedPosts.add(postId);

    const content = this.extractContent(postElement);
    const poster = this.extractPoster(postElement);
    
    if (!content || content.length < 10) return; // Skip very short posts

    // Show loading indicator
    this.addLoadingIndicator(postElement);
    
    try {
      const analysis = await this.analyzeWithAI(content, poster);
      this.stats.analyzed++;

      if (!analysis.shouldShow) {
        this.hidePost(postElement, analysis.reason, poster);
        this.stats.filtered++;
        this.updateStatusIndicator();
      }
      
    } catch (error) {
      console.error('Content analysis failed:', error);
      // Even on error, we should track that we tried to analyze
      this.stats.analyzed++;
    } finally {
      // Always remove loading indicator
      this.removeLoadingIndicator(postElement);
    }
  }

  getPostId(element) {
    return element.getAttribute('data-tweet-id') || 
           element.getAttribute('data-post-id') || 
           element.id || 
           element.outerHTML.substring(0, 100);
  }

  extractContent(postElement) {
    const contentSelectors = {
      twitter: '[data-testid="tweetText"]',
      facebook: '[data-ad-preview="message"]',
      instagram: 'img[alt]',
      linkedin: '.feed-shared-text',
      reddit: '[data-testid="post-content"]'
    };

    const selector = contentSelectors[this.platform];
    const contentEl = postElement.querySelector(selector);
    
    if (contentEl) {
      return contentEl.textContent || contentEl.alt || '';
    }

    // Fallback: get all text content
    return postElement.textContent?.substring(0, 1000) || '';
  }

  extractPoster(postElement) {
    const posterSelectors = {
      twitter: '[data-testid="User-Name"] span:first-child, [data-testid="User-Name"] a span',
      facebook: 'h3 a, [data-ad-preview="message"] strong',
      instagram: 'a[href*="/"] span, header a span',
      linkedin: '.feed-shared-actor__name, .feed-shared-actor__title a',
      reddit: '[data-testid="post_author_link"], .author'
    };

    const selector = posterSelectors[this.platform];
    if (!selector) return 'Unknown User';

    const posterEl = postElement.querySelector(selector);
    if (posterEl) {
      // Clean up the username (remove @ symbols, etc.)
      let username = posterEl.textContent?.trim() || 'Unknown User';
      username = username.replace(/^@/, ''); // Remove leading @
      return username;
    }

    // Fallback: try to find any username-like text
    const possibleUsernames = postElement.querySelectorAll('a[href*="/"]');
    for (const link of possibleUsernames) {
      const href = link.getAttribute('href');
      if (href && href.includes('/') && !href.includes('/status/') && !href.includes('/post/')) {
        const username = href.split('/').pop();
        if (username && username.length > 0) {
          return username.replace(/^@/, '');
        }
      }
    }

    return 'Unknown User';
  }

  async analyzeWithAI(content, poster = 'Unknown') {
    const metadata = {
      poster: poster,
      platform: this.platform,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'analyzeContent', content, metadata },
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
  }

  hidePost(postElement, reason, poster) {
    // Create a replacement element
    const placeholder = document.createElement('div');
    placeholder.className = 'positive-vibes-filtered';
    placeholder.style.cssText = `
      margin: 10px 0;
      padding: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
      text-align: center;
      font-size: 14px;
      border: 2px solid #8b5cf6;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    const posterInfo = poster && poster !== 'Unknown User' ? `<div style="opacity: 0.7; font-size: 11px;">From: @${poster}</div>` : '';
    
    placeholder.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 5px;">✨ Content Filtered for Positivity</div>
      <div style="opacity: 0.8; font-size: 12px;">Reason: ${reason}</div>
      ${posterInfo}
      <div style="opacity: 0.7; font-size: 11px; margin-top: 5px;">Click to show anyway</div>
    `;

    // Store original element for restoration
    placeholder._originalElement = postElement.cloneNode(true);
    
    // Add click handler to restore content
    placeholder.addEventListener('click', () => {
      postElement.style.display = '';
      placeholder.remove();
    });

    // Hide original and insert placeholder
    postElement.style.display = 'none';
    postElement.parentNode.insertBefore(placeholder, postElement);
  }

  addLoadingIndicator(postElement) {
    // Remove any existing indicators first
    this.removeLoadingIndicator(postElement);
    
    const indicator = document.createElement('div');
    indicator.className = 'positive-vibes-loading';
    indicator.setAttribute('data-created', Date.now().toString());
    indicator.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(139, 92, 246, 0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      z-index: 1000;
      animation: pulse 1.5s ease-in-out infinite alternate;
    `;
    indicator.textContent = '🔍 Analyzing...';
    
    // Add pulse animation
    if (!document.getElementById('positive-vibes-animation')) {
      const style = document.createElement('style');
      style.id = 'positive-vibes-animation';
      style.textContent = `
        @keyframes pulse {
          from { opacity: 1; }
          to { opacity: 0.6; }
        }
      `;
      document.head.appendChild(style);
    }
    
    postElement.style.position = 'relative';
    postElement.appendChild(indicator);
  }

  removeLoadingIndicator(postElement) {
    // Try multiple ways to find and remove loading indicators
    const indicators = postElement.querySelectorAll('.positive-vibes-loading');
    indicators.forEach(indicator => indicator.remove());
    
    // Also check for any orphaned indicators in case the element structure changed
    setTimeout(() => {
      const orphanedIndicators = document.querySelectorAll('.positive-vibes-loading');
      orphanedIndicators.forEach(indicator => {
        // Remove if it's been there for more than 10 seconds
        const createdTime = indicator.getAttribute('data-created') || Date.now();
        if (Date.now() - parseInt(createdTime) > 10000) {
          indicator.remove();
        }
      });
    }, 500);
  }

  addStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'positive-vibes-status';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(139, 92, 246, 0.95);
      color: white;
      padding: 10px 15px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 10000;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
    `;
    
    this.updateStatusIndicator();
    document.body.appendChild(indicator);
  }

  updateStatusIndicator() {
    const indicator = document.getElementById('positive-vibes-status');
    if (indicator) {
      indicator.innerHTML = `
        ✨ Positive Vibes Active<br>
        Analyzed: ${this.stats.analyzed} | Filtered: ${this.stats.filtered}
      `;
    }
  }
}

// Initialize filter when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SocialMediaFilter());
} else {
  new SocialMediaFilter();
}