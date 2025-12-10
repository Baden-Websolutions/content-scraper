/**
 * Navigation-Based Crawler
 * 
 * Crawls websites following navigation structure with level-based control
 * Level 1: All main navigation links
 * Level 2: All sub-pages
 * Level 3: Sample pages only
 * Legal pages: Always included
 * 
 * @module core/navigation_crawler
 */

const cheerio = require('cheerio');

class NavigationCrawler {
  constructor(config = {}) {
    this.config = {
      maxLevel: config.maxLevel || 3,
      levelLimits: config.levelLimits || {
        1: -1,  // -1 = unlimited
        2: -1,  // -1 = unlimited
        3: 1,   // only 1 per category
      },
      legalKeywords: config.legalKeywords || [
        'impressum', 'datenschutz', 'agb', 'privacy', 
        'terms', 'legal', 'cookies', 'disclaimer'
      ],
      navigationSelectors: config.navigationSelectors || [
        'nav a', 'header a', '[role="navigation"] a',
        '.navigation a', '.menu a', '.navbar a'
      ]
    };

    this.urlLevels = new Map(); // URL -> level
    this.levelCounts = new Map(); // level -> count
    this.categoryPages = new Map(); // category -> pages
  }

  /**
   * Detect if URL is a legal page
   */
  isLegalPage(url) {
    const urlLower = url.toLowerCase();
    return this.config.legalKeywords.some(keyword => 
      urlLower.includes(keyword)
    );
  }

  /**
   * Extract navigation links from HTML
   */
  extractNavigationLinks(html, currentUrl) {
    const $ = cheerio.load(html);
    const navLinks = [];

    // Extract from navigation elements
    this.config.navigationSelectors.forEach(selector => {
      $(selector).each((i, link) => {
        const href = $(link).attr('href');
        const text = $(link).text().trim();
        
        if (href && !href.startsWith('#')) {
          navLinks.push({
            href,
            text,
            isNavigation: true
          });
        }
      });
    });

    // Extract footer links (potential legal pages)
    $('footer a').each((i, link) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim();
      
      if (href && !href.startsWith('#')) {
        navLinks.push({
          href,
          text,
          isFooter: true
        });
      }
    });

    return navLinks;
  }

  /**
   * Determine level for a URL based on parent
   */
  determineLevel(url, parentUrl) {
    // Legal pages always get priority
    if (this.isLegalPage(url)) {
      return 0; // Special level for legal pages
    }

    // If no parent, it's level 1
    if (!parentUrl) {
      return 1;
    }

    // Get parent level
    const parentLevel = this.urlLevels.get(parentUrl) || 0;
    return parentLevel + 1;
  }

  /**
   * Check if URL should be crawled based on level limits
   */
  shouldCrawl(url, parentUrl) {
    const level = this.determineLevel(url, parentUrl);
    
    // Always crawl legal pages
    if (level === 0) {
      return true;
    }

    // Check max level
    if (level > this.config.maxLevel) {
      return false;
    }

    // Check level-specific limits
    const limit = this.config.levelLimits[level];
    if (limit === -1) {
      return true; // unlimited
    }

    const currentCount = this.levelCounts.get(level) || 0;
    return currentCount < limit;
  }

  /**
   * Register a crawled URL
   */
  registerUrl(url, parentUrl) {
    const level = this.determineLevel(url, parentUrl);
    this.urlLevels.set(url, level);

    // Increment level count
    const currentCount = this.levelCounts.get(level) || 0;
    this.levelCounts.set(level, currentCount + 1);

    return level;
  }

  /**
   * Get category for level 3 pages
   */
  getCategory(url) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    // Use first two path segments as category
    return pathParts.slice(0, 2).join('/') || 'root';
  }

  /**
   * Check if should crawl level 3 page (only 1 per category)
   */
  shouldCrawlLevel3(url) {
    const category = this.getCategory(url);
    const pagesInCategory = this.categoryPages.get(category) || [];
    
    const limit = this.config.levelLimits[3] || 1;
    return pagesInCategory.length < limit;
  }

  /**
   * Register level 3 page
   */
  registerLevel3Page(url) {
    const category = this.getCategory(url);
    const pagesInCategory = this.categoryPages.get(category) || [];
    pagesInCategory.push(url);
    this.categoryPages.set(category, pagesInCategory);
  }

  /**
   * Prioritize URLs for crawling
   */
  prioritizeUrls(urls) {
    return urls.sort((a, b) => {
      const levelA = this.urlLevels.get(a.url) || 999;
      const levelB = this.urlLevels.get(b.url) || 999;

      // Legal pages first (level 0)
      if (levelA === 0 && levelB !== 0) return -1;
      if (levelB === 0 && levelA !== 0) return 1;

      // Then by level
      if (levelA !== levelB) return levelA - levelB;

      // Navigation links before content links
      if (a.isNavigation && !b.isNavigation) return -1;
      if (b.isNavigation && !a.isNavigation) return 1;

      return 0;
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalUrls: this.urlLevels.size,
      byLevel: {}
    };

    for (const [level, count] of this.levelCounts.entries()) {
      stats.byLevel[level === 0 ? 'legal' : `level${level}`] = count;
    }

    return stats;
  }
}

module.exports = { NavigationCrawler };
