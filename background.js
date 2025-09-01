// File path: /background.js
// Background service worker for handling API calls and audit logging
class AIFilterService {
  constructor() {
    this.rateLimiter = new Map();
    this.auditLogMap = {}; // HashMap for audit entries
    this.maxAuditEntries = 400; // Store last 400 API calls
    this.setupMessageListener();
    this.initializeAuditLog();
  }

  async initializeAuditLog() {
    const data = await chrome.storage.local.get(['auditLogMap']);
    this.auditLogMap = data.auditLogMap || {};
  }

  // Simple string hash function for generating post IDs
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Generate unique post ID from content, poster, and platform
  generatePostId(content, poster, platform) {
    // Use first 1000 characters for ID generation
    const normalizedContent = content.trim().replace(/\s+/g, ' ').toLowerCase();
    const contentForId = normalizedContent.substring(0, 1000);
    const idString = `${platform}|${poster}|${contentForId}`;
    return this.simpleHash(idString);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'analyzeContent') {
        this.analyzeContent(request.content, request.metadata)
          .then(result => sendResponse({success: true, result}))
          .catch(error => sendResponse({success: false, error: error.message}));
        return true; // Keep message channel open for async response
      } else if (request.action === 'getDefaultPrompt') {
        sendResponse({defaultPrompt: this.getDefaultPrompt()});
      } else if (request.action === 'getAuditLog') {
        this.getAuditLog(request.searchQuery, request.limit)
          .then(results => sendResponse({success: true, results}))
          .catch(error => sendResponse({success: false, error: error.message}));
        return true;
      } else if (request.action === 'getPosterAnalytics') {
        this.getPosterAnalytics()
          .then(results => sendResponse({success: true, results}))
          .catch(error => sendResponse({success: false, error: error.message}));
        return true;
      } else if (request.action === 'clearAuditLog') {
        this.clearAuditLog()
          .then(() => sendResponse({success: true}))
          .catch(error => sendResponse({success: false, error: error.message}));
        return true;
      }
    });
  }

  async analyzeContent(content, metadata = {}) {
    const poster = metadata.poster || 'Unknown';
    const platform = metadata.platform || 'Unknown';
    
    // Generate unique post ID
    const postId = this.generatePostId(content, poster, platform);
    
    // Check if this post has already been analyzed
    if (this.auditLogMap[postId]) {
      console.log('Post already analyzed, skipping:', postId);
      return this.auditLogMap[postId].response || { shouldShow: true, reason: 'Already analyzed' };
    }

    // Rate limiting: max 60 requests per minute
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const currentCount = this.rateLimiter.get(minute) || 0;
    
    if (currentCount >= 60) {
      throw new Error('Rate limit exceeded. Please wait a moment.');
    }
    
    this.rateLimiter.set(minute, currentCount + 1);

    // Get settings
    const settings = await chrome.storage.sync.get([
      'apiProvider', 'aiModel', 'apiKey', 'filterStrength', 'enabled', 'customPrompt'
    ]);

    if (!settings.enabled) {
      return { shouldShow: true, reason: 'Filter disabled' };
    }

    if (!settings.apiKey) {
      throw new Error('API key not configured');
    }

    const auditEntry = {
      id: postId,
      timestamp: new Date().toISOString(),
      content: content.substring(0, 1000), // Store up to 1000 characters
      poster: poster,
      platform: platform,
      filterStrength: settings.filterStrength,
      apiProvider: settings.apiProvider,
      aiModel: settings.aiModel || 'gpt-4o-mini',
      prompt: this.createPrompt(content, settings.filterStrength, settings.customPrompt),
      response: null,
      error: null
    };

    try {
      let result;
      
      if (settings.apiProvider === 'openai') {
        result = await this.callOpenAI(content, settings);
      } else if (settings.apiProvider === 'grok') {
        result = await this.callGrok(content, settings);
      } else {
        throw new Error('Invalid API provider');
      }

      auditEntry.response = result;
      await this.addToAuditLog(postId, auditEntry);
      
      return result;
    } catch (error) {
      console.error('AI Analysis failed:', error);
      auditEntry.error = error.message;
      await this.addToAuditLog(postId, auditEntry);
      
      // On error, default to showing content to avoid over-filtering
      return { shouldShow: true, reason: 'Analysis failed' };
    }
  }

  async callOpenAI(content, settings) {
    const prompt = this.createPrompt(content, settings.filterStrength, settings.customPrompt);
    const model = settings.aiModel || 'gpt-4o-mini';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a content analyzer focused on mental health and positivity. Respond only with JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseAIResponse(data.choices[0].message.content);
  }

  async callGrok(content, settings) {
    const prompt = this.createPrompt(content, settings.filterStrength, settings.customPrompt);
    const model = settings.aiModel || 'grok-beta';
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a content analyzer focused on mental health and positivity. Respond only with JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseAIResponse(data.choices[0].message.content);
  }

  createPrompt(content, filterStrength, customPrompt = null) {
    const strengthDescriptions = {
      low: 'only filter extremely negative content like hate speech, threats, or severe harassment',
      medium: 'filter negative content including arguments, complaints, doom scrolling content, or generally pessimistic posts',
      high: 'only allow highly positive, uplifting, educational, or constructive content'
    };

    const defaultPrompt = `Analyze this social media content for positive mental impact. Filter strength: ${filterStrength} - ${strengthDescriptions[filterStrength]}.

Content: "${content}"

Respond with only this JSON format:
{
  "shouldShow": true/false,
  "score": 1-10,
  "reason": "brief explanation"
}

Score 1-10 where 10 is most positive mental impact. Use shouldShow: false to filter content based on the ${filterStrength} filter strength.`;

    // Use custom prompt if provided, otherwise use default
    if (customPrompt && customPrompt.trim()) {
      return customPrompt.replace('{{CONTENT}}', content).replace('{{FILTER_STRENGTH}}', filterStrength);
    }

    return defaultPrompt;
  }

  parseAIResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing
      const shouldShow = !response.toLowerCase().includes('"shouldshow": false');
      return {
        shouldShow,
        score: 5,
        reason: 'Failed to parse AI response'
      };
    } catch (error) {
      return {
        shouldShow: true,
        score: 5,
        reason: 'Response parsing error'
      };
    }
  }

  getDefaultPrompt() {
    return `Analyze this social media content for positive mental impact. Filter strength: {{FILTER_STRENGTH}} - based on the selected filter level.

Content: "{{CONTENT}}"

Respond with only this JSON format:
{
  "shouldShow": true/false,
  "score": 1-10,
  "reason": "brief explanation"
}

Score 1-10 where 10 is most positive mental impact. Use shouldShow: false to filter content based on the {{FILTER_STRENGTH}} filter strength.

Filter Level Guidelines:
- LOW: only filter extremely negative content like hate speech, threats, or severe harassment
- MEDIUM: filter negative content including arguments, complaints, doom scrolling content, or generally pessimistic posts  
- HIGH: only allow highly positive, uplifting, educational, or constructive content`;
  }

  async addToAuditLog(postId, entry) {
    this.auditLogMap[postId] = entry;
    
    // Limit storage to prevent performance issues
    const entryCount = Object.keys(this.auditLogMap).length;
    if (entryCount > this.maxAuditEntries) {
      // Remove oldest entries (by timestamp)
      const sortedEntries = Object.values(this.auditLogMap)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const entriesToRemove = sortedEntries.slice(0, entryCount - this.maxAuditEntries);
      entriesToRemove.forEach(entry => {
        delete this.auditLogMap[entry.id];
      });
    }

    // Save to storage periodically
    if (entryCount % 5 === 0) {
      await this.saveAuditLog();
    }
  }

  async getAuditLog(searchQuery = '', limit = 50) {
    await this.saveAuditLog(); // Ensure latest data is saved
    
    let results = Object.values(this.auditLogMap);

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply fuzzy search if query provided
    if (searchQuery && searchQuery.trim()) {
      results = this.fuzzySearch(results, searchQuery.toLowerCase());
    }

    // Limit results
    return results.slice(0, limit);
  }

  async getPosterAnalytics() {
    await this.saveAuditLog(); // Ensure latest data is saved
    
    const posterStats = {};
    const entries = Object.values(this.auditLogMap);

    // Process all audit entries to build poster statistics
    entries.forEach(entry => {
      const poster = entry.poster;
      if (poster === 'Unknown' || !poster) return;

      if (!posterStats[poster]) {
        posterStats[poster] = {
          username: poster,
          postCount: 0,
          allowed: 0,
          filtered: 0,
          totalScore: 0,
          averageScore: 0,
          platform: entry.platform
        };
      }

      const stats = posterStats[poster];
      stats.postCount++;
      stats.totalScore += entry.response?.score || 5;

      if (entry.response?.shouldShow) {
        stats.allowed++;
      } else {
        stats.filtered++;
      }

      stats.averageScore = Math.round((stats.totalScore / stats.postCount) * 10) / 10;
    });

    // Convert to arrays and categorize
    // ALL TRACKED: Show everyone with 1+ posts (no minimum)
    const allPosters = Object.values(posterStats)
      .sort((a, b) => b.postCount - a.postCount); // Sort by post count

    // TOXIC: Requires 5+ posts AND >50% filtered
    const toxicPosters = allPosters
      .filter(stats => stats.postCount >= 5 && (stats.filtered / stats.postCount) > 0.5)
      .sort((a, b) => (b.filtered / b.postCount) - (a.filtered / a.postCount))
      .slice(0, 20);

    // HEALTHY: Requires 5+ posts AND >80% allowed AND avg score >6
    const healthyPosters = allPosters
      .filter(stats => stats.postCount >= 5 && (stats.allowed / stats.postCount) > 0.8 && stats.averageScore > 6)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 20);

    return {
      all: allPosters,
      toxic: toxicPosters,
      healthy: healthyPosters,
      totalPosters: Object.keys(posterStats).length
    };
  }

  fuzzySearch(entries, query) {
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    return entries.filter(entry => {
      const searchableText = [
        entry.content,
        entry.poster,
        entry.platform,
        entry.response?.reason || '',
        entry.error || ''
      ].join(' ').toLowerCase();

      // Check if all search terms are found (fuzzy matching)
      return searchTerms.every(term => {
        return searchableText.includes(term) || 
               this.fuzzyMatch(searchableText, term);
      });
    });
  }

  fuzzyMatch(text, term) {
    // Simple fuzzy matching - allows for 1 character difference per 4 characters
    const maxErrors = Math.floor(term.length / 4);
    
    for (let i = 0; i <= text.length - term.length + maxErrors; i++) {
      let errors = 0;
      let j = 0;
      
      for (let k = i; k < text.length && j < term.length; k++) {
        if (text[k] === term[j]) {
          j++;
        } else {
          errors++;
          if (errors > maxErrors) break;
          j++;
        }
      }
      
      if (j === term.length && errors <= maxErrors) {
        return true;
      }
    }
    
    return false;
  }

  async saveAuditLog() {
    await chrome.storage.local.set({ auditLogMap: this.auditLogMap });
  }

  async clearAuditLog() {
    this.auditLogMap = {};
    await chrome.storage.local.remove(['auditLogMap']);
  }
}

// Initialize the service
new AIFilterService();