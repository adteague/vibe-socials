# Positive Vibes Social Filter - Installation Guide

## 🛠️ Recent Fixes & Improvements:
- **Fixed Text Overflow**: Settings page now properly wraps long text in prompt previews
- **Fixed "Analyzing" Status**: Loading indicators are now properly removed, preventing stuck states
- **Added Multiple AI Models**: Choose from GPT-4o Mini, GPT-3.5 Turbo, GPT-4o, and GPT-4 Turbo
- **Fixed Audit Log Access**: Audit log button now properly opens the audit interface
- **Improved Error Handling**: Better fallbacks when API calls fail

## Complete File Structure
**All files should be in the ROOT folder:**

```
positive-vibes-extension/
├── manifest.json          (Extension configuration)
├── background.js          (API handling service worker)
├── content.js            (Main filtering logic)
├── popup.html            (Extension popup interface)
├── popup.js              (Popup functionality)
├── options.html          (Settings page)
├── options.js            (Settings functionality)
├── analytics.html        (NEW: Poster analytics page)
└── analytics.js          (NEW: Analytics functionality)
```

## New Features Added: Complete Transparency & Audit Trail

### 🔍 Complete Transparency:
- **Visible Analysis Prompt**: See the exact prompt sent to AI for every analysis
- **Live Preview**: Watch how your prompt changes with different settings
- **Custom Prompts**: Modify the AI analysis criteria to match your preferences
- **Reset to Default**: Easily restore the original prompt template

### 📋 Complete Audit Trail:
- **API Call Logging**: Every analysis request/response is stored with full metadata
- **Fuzzy Search**: Find specific filtering decisions using flexible keyword search
- **Advanced Filtering**: Filter audit entries by status, platform, AI provider, or time period
- **Full Transparency**: See exact prompts sent and AI responses received for every post
- **Performance Insights**: Summary statistics and patterns across all filtering decisions
- **Storage Optimization**: Content truncated to 500 characters for efficient storage and display

### 🎯 Per-Poster Analytics:
- **Poster Tracking**: Tracks allowed vs filtered posts for each social media account
- **Toxic Poster Detection**: Identifies accounts with >50% filtered content
- **Healthy Poster Recognition**: Highlights accounts with consistently positive content (>80% allowed, 6+ average score)
- **Actionable Insights**: Provides tools to block/mute problematic accounts

### 📊 Analytics Features:
1. **Summary Dashboard**: Overview of total tracked posters, posts, and filtering stats
2. **Toxic Posters Tab**: Shows accounts frequently posting negative content
3. **Healthy Posters Tab**: Shows accounts consistently posting positive content  
4. **All Tracked Tab**: Complete list of all monitored accounts
5. **Action Buttons**: Easy access to profile, copy username, and platform-specific blocking instructions

### 🔍 Transparency Features:
1. **Current Active Prompt**: See exactly what prompt is being sent to analyze your posts
2. **Default Prompt Viewer**: View the built-in analysis template
3. **Live Preview**: See how your custom prompt will look with sample content
4. **Custom Prompt Editor**: Modify analysis criteria with placeholder variables:
   - `{{CONTENT}}` - The post content to analyze
   - `{{FILTER_STRENGTH}}` - Current filter setting (low/medium/high)
5. **Reset to Default**: Restore original prompt template anytime

### 🔍 Complete Audit Log System:
1. **Full API Call History**: Every analysis request and response is logged with metadata
2. **Fuzzy Search**: Search through audit entries by content, poster, reason, or any keyword
3. **Advanced Filters**: Filter by status (filtered/allowed/error), platform, AI provider, time period
4. **Request/Response Transparency**: See the exact prompt sent and AI response received
5. **Expandable Details**: Click to view full analysis prompts for any entry
6. **Performance Stats**: Summary statistics across all logged entries
7. **Data Management**: Clear audit log when needed (stores last 1000 entries for performance)
8. **Content Storage**: Post content stored locally for reference (truncated to 500 chars for efficiency)

### 🔧 How to Access Features:
- **Analytics**: Click extension icon → "📊 Poster Analytics" (now always works!)
- **Audit Log**: Click extension icon → "📜 Audit Log"  
- **Prompt Transparency**: Click extension icon → "⚙️ Settings" → View "Current Active Prompt" section
- **Custom Prompts**: In Settings → Edit "AI Analysis Prompt" section

### 🔍 What Changed in This Version:
- **Before**: Poster analytics tracked separately from audit log, could be lost
- **After**: Poster analytics computed from audit log in real-time, never lost
- **Before**: Posts could be analyzed multiple times across sessions
- **After**: HashMap with content-based IDs prevents duplicate analysis
- **Before**: Analytics only worked when on social media pages
- **After**: Analytics always work since they're computed from persistent audit log
- **Before**: 500 characters stored per post
- **After**: 1000 characters stored per post for better duplicate detection and analysis

## Installation Steps:

1. **Create a folder** (e.g., `positive-vibes-extension`)
2. **Save all 8 files** directly in that folder (no subfolders!)
3. **Open Chrome** → `chrome://extensions/`
4. **Enable "Developer mode"** (toggle in top-right)
5. **Click "Load unpacked"** → select your folder
6. **Configure API key** (click extension icon → Settings)

### 🤖 AI Model Options:
- **OpenAI Models**: GPT-4o Mini (fastest/cheapest), GPT-3.5 Turbo, GPT-4o, GPT-4 Turbo (highest quality)
- **Grok Models**: Grok Beta
- **Model Selection**: Choose based on your needs for speed vs accuracy vs cost
- **Recommendations**:
  - **High Volume Filtering**: GPT-4o Mini or GPT-3.5 Turbo
  - **Best Accuracy**: GPT-4 Turbo  
  - **Balanced**: GPT-4o

## API Key Setup:
- **OpenAI**: Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Grok**: Get your key at [console.x.ai](https://console.x.ai)

## How Poster Analytics Work:

### Data Collected:
- **Username/Handle**: Extracted from each post
- **Posts Analyzed**: Total number of posts seen from this user
- **Posts Allowed**: Posts that passed the positivity filter
- **Posts Filtered**: Posts hidden due to negative impact
- **Average Score**: Mean positivity score (1-10 scale)
- **Filter Rate**: Percentage of posts that get filtered

### Categorization:
- **Toxic Posters**: >50% of their posts get filtered
- **Healthy Posters**: >80% allowed + average score >6
- **Platform URLs**: Direct links to profiles for easy blocking/unfollowing

### Privacy & Storage:
- All data stored locally in your browser (never transmitted to external servers except AI APIs)
- **Audit log is now the master database** - contains all your social media filtering history
- **HashMap deduplication** prevents storage bloat and duplicate API calls
- Statistics and audit data reset when you clear extension data or browser storage
- API keys stored securely in Chrome sync storage
- **Full prompt transparency** - you always know exactly how your content is being analyzed
- **Optimized storage**: Limited to 400 unique posts with up to 1000 characters each
- **Persistent analytics**: Your poster insights survive browser restarts

### Customization Examples:
**Focus on Mental Health:**
```
Analyze this post for mental health impact: "{{CONTENT}}"

Consider: Does this promote anxiety, depression, self-harm, or negative self-talk? 
Filter strength: {{FILTER_STRENGTH}}

Return JSON: {"shouldShow": true/false, "score": 1-10, "reason": "explanation"}
```

**Focus on Productivity:**
```
Evaluate if this content supports focus and productivity: "{{CONTENT}}"

Filter distractions, outrage, and time-wasting content based on {{FILTER_STRENGTH}} level.

Return JSON: {"shouldShow": true/false, "score": 1-10, "reason": "explanation"}
```

### 🔍 Audit Log Use Cases:
**Debugging Filtering Decisions:**
- Search: "why was this hidden" → Find specific filtered posts
- Search: "@username" → See all decisions for a specific poster
- Search: "anxiety" → Find posts about mental health topics

**Understanding AI Behavior:**
- Filter by "Filtered Only" → See what content gets blocked
- View full prompts → Understand exact analysis criteria
- Check error entries → Identify API issues or rate limiting

**Optimizing Your Experience:**
- High-scored filtered content → Adjust prompt to be less strict
- Low-scored allowed content → Adjust prompt to be more strict
- Search by platform → See if filtering works differently across sites

The audit log provides complete transparency - you can see every single filtering decision, the exact prompt used, and the AI's reasoning, with powerful search to find specific entries!

The analytics give you data-driven insights to curate your social media feeds, while full prompt transparency ensures you understand and control exactly how content filtering decisions are made!