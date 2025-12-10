# Content Scraper - Deployment Guide

## 📦 Repository Information

**Repository:** https://github.com/Baden-Websolutions/content-scraper  
**Status:** ✅ Public (temporarily for sharing)  
**Created:** December 10, 2025

## 🔒 Making Repository Private

The repository was created as **public** for easy sharing and demonstration purposes. To make it private:

### Option 1: GitHub Web Interface

1. Go to https://github.com/Baden-Websolutions/content-scraper
2. Click on **Settings** (top right)
3. Scroll down to **Danger Zone**
4. Click **Change repository visibility**
5. Select **Make private**
6. Confirm by typing the repository name
7. Click **I understand, change repository visibility**

### Option 2: GitHub CLI

```bash
gh repo edit Baden-Websolutions/content-scraper --visibility private
```

### Option 3: GitHub API

```bash
curl -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/Baden-Websolutions/content-scraper \
  -d '{"private":true}'
```

## 🧪 Test Results

### lenzingpro.com Scraping Test

**Date:** December 10, 2025  
**Duration:** 55.84 seconds  
**Configuration:**
- Base URL: https://lenzingpro.com
- Max Pages: 100
- Download Images: No
- Navigation-based crawling: Yes

**Results:**
- ✅ **17 pages** successfully scraped
- ✅ **0 errors**
- ✅ **1,503,121 words** extracted
- ✅ **Level distribution:** 1 Level 1, 16 Level 2

**Output Files:**
- `output/lenzingpro_full_2025-12-10T06-56-44-428Z.json` (2.0 MB)
- `output/lenzingpro_summary_2025-12-10T06-56-44-428Z.json` (3.8 KB)

### Scraped Pages

| # | URL | Title | Level | Links | Images |
|---|-----|-------|-------|-------|--------|
| 1 | / | Lenzing Pro | 1 | 74 | 44 |
| 2 | /en/portal/c/TX | E-Branding Service | 2 | 84 | 44 |
| 3 | /en/portal/tencelBrand | E-Branding Service | 2 | 82 | 27 |
| 4 | /en/portal/ecoVeroBrand | E-Branding Service | 2 | 82 | 25 |
| 5 | /en/portal/veocelBrand | E-Branding Service | 2 | 80 | 28 |
| 6 | /en/portal/technology | Technology Page | 2 | 74 | 25 |
| 7 | /en/portal/certificates | Certificates Page | 2 | 74 | 26 |
| 8 | /en/portal/contact?topic=buy | Contact Us | 2 | 74 | 14 |
| 9 | /en/portal/contact?topic=helpdesk | Contact Us | 2 | 74 | 14 |
| 10 | /en/portal/contact?topic=sourcing | Contact Us | 2 | 74 | 14 |
| 11 | /en/portal/licensingService | Licensing Service | 2 | 82 | 32 |
| 12 | /en/portal/certificationService | Certification | 2 | 82 | 24 |
| 13 | /en/portal/contact | Contact Us | 2 | 74 | 14 |
| 14 | /en/portal/c/CLY | E-Branding Service | 2 | 84 | 36 |
| 15 | /en/portal/c/CMD | E-Branding Service | 2 | 84 | 28 |
| 16 | /en/portal/c/CV | E-Branding Service | 2 | 84 | 22 |
| 17 | /en/portal | Login Page | 2 | 74 | 14 |

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/Baden-Websolutions/content-scraper.git
cd content-scraper
npm install
```

### Run Test Script

```bash
node test_lenzingpro.js
```

### Use Web UI

```bash
npm run server
# Open http://localhost:3000
```

### Use CLI

```bash
node cli.js --url https://lenzingpro.com --max-pages 100
```

## 📊 Features Implemented

### ✅ Navigation-Based Crawling
- Level 1: All main navigation links
- Level 2: All sub-pages
- Level 3: Sample pages only (1 per category)
- Legal pages: Always included

### ✅ Multi-Platform Export
- JSON (Raw + Enhanced)
- Storyblok Stories
- Nuxt.js Components
- SAP Commerce Cloud (ImpEx)
- XML Sitemap

### ✅ Live Tracking
- WebSocket-based real-time updates
- Progress monitoring
- Error tracking
- Statistics dashboard

## 🔧 Configuration

### Navigation Crawler Settings

```javascript
{
  maxLevel: 3,
  levelLimits: {
    1: -1,  // Unlimited
    2: -1,  // Unlimited
    3: 1    // Only 1 per category
  },
  legalKeywords: [
    'impressum', 'datenschutz', 'agb', 
    'privacy', 'terms', 'legal', 'cookies'
  ]
}
```

## 📝 Changes from v1.0

### Removed
- ❌ All GMT references
- ❌ Project-specific naming

### Updated
- ✅ Examples now use lenzingpro.com
- ✅ Generic naming throughout

### Added
- ✅ Navigation-based crawler (`core/navigation_crawler.js`)
- ✅ Enhanced scraper (`core/scraper_enhanced.js`)
- ✅ Test script (`test_lenzingpro.js`)
- ✅ Level-based crawling strategy
- ✅ Legal page detection

## 🎯 Next Steps

1. **Make repository private** (see instructions above)
2. **Enable image downloading** when needed
3. **Customize navigation selectors** for specific sites
4. **Adjust level limits** based on requirements
5. **Add authentication** for protected sites

## 📞 Support

For issues or questions:
- GitHub Issues: https://github.com/Baden-Websolutions/content-scraper/issues
- Documentation: See README.md and DOCUMENTATION.md

---

**Note:** Remember to make the repository private after sharing is complete!
