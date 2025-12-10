/**
 * Enhanced Content Scraper with Navigation-Based Crawling
 * 
 * @module core/scraper_enhanced
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { NavigationCrawler } = require('./navigation_crawler');

class EnhancedContentScraper {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.maxPages = config.maxPages || 100;
    this.delay = config.delay || 1000;
    this.headless = config.headless !== false;
    this.timeout = config.timeout || 30000;
    this.userAgent = config.userAgent || 'Mozilla/5.0 (compatible; ContentScraper/1.0)';
    this.downloadImages = config.downloadImages || false;
    
    // Navigation crawler
    this.navCrawler = new NavigationCrawler({
      maxLevel: 3,
      levelLimits: {
        1: -1,  // All level 1 pages
        2: -1,  // All level 2 pages
        3: 1    // Only 1 level 3 page per category
      }
    });
    
    // Tracking
    this.scrapedPages = [];
    this.failedPages = [];
    this.visitedUrls = new Set();
    this.pendingUrls = [];
    
    // Callbacks
    this.onProgress = config.onProgress || (() => {});
    this.onPageComplete = config.onPageComplete || (() => {});
    this.onError = config.onError || (() => {});
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(this.userAgent);
    this.page.setDefaultNavigationTimeout(this.timeout);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  normalizeUrl(url, baseUrl) {
    try {
      const normalized = new URL(url, baseUrl).href;
      // Remove trailing slash for consistency
      return normalized.replace(/\/$/, '');
    } catch (e) {
      return null;
    }
  }

  isInternalUrl(url) {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(this.baseUrl);
      return urlObj.hostname === baseObj.hostname;
    } catch (e) {
      return false;
    }
  }

  async scrapePage(url, parentUrl = null) {
    try {
      console.log(`Scraping: ${url}`);
      
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      
      const html = await this.page.content();
      const $ = cheerio.load(html);

      // Extract basic page data
      const pageData = {
        url: url,
        title: $('title').text() || '',
        metaDescription: $('meta[name="description"]').attr('content') || '',
        h1: $('h1').first().text().trim() || '',
        content: $('body').text().replace(/\s+/g, ' ').trim(),
        contentLength: $('body').text().length,
        links: [],
        images: [],
        scrapedAt: new Date().toISOString()
      };

      // Extract navigation links
      const navLinks = this.navCrawler.extractNavigationLinks(html, url);
      
      // Process links
      for (const link of navLinks) {
        const absoluteUrl = this.normalizeUrl(link.href, url);
        if (absoluteUrl && this.isInternalUrl(absoluteUrl)) {
          pageData.links.push({
            text: link.text,
            url: absoluteUrl,
            isNavigation: link.isNavigation || false,
            isFooter: link.isFooter || false
          });

          // Add to pending if not visited and should crawl
          if (!this.visitedUrls.has(absoluteUrl) && 
              this.navCrawler.shouldCrawl(absoluteUrl, url)) {
            
            const level = this.navCrawler.determineLevel(absoluteUrl, url);
            
            // Special handling for level 3
            if (level === 3) {
              if (this.navCrawler.shouldCrawlLevel3(absoluteUrl)) {
                this.pendingUrls.push({
                  url: absoluteUrl,
                  parentUrl: url,
                  level: level,
                  isNavigation: link.isNavigation
                });
                this.navCrawler.registerLevel3Page(absoluteUrl);
              }
            } else {
              this.pendingUrls.push({
                url: absoluteUrl,
                parentUrl: url,
                level: level,
                isNavigation: link.isNavigation
              });
            }
          }
        }
      }

      // Extract images (metadata only, no download for now)
      if (!this.downloadImages) {
        $('img').each((i, img) => {
          const src = $(img).attr('src');
          const alt = $(img).attr('alt') || '';
          if (src) {
            pageData.images.push({
              src: this.normalizeUrl(src, url),
              alt: alt
            });
          }
        });
      }

      return pageData;

    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      this.failedPages.push({ url, error: error.message });
      this.onError({ url, error: error.message });
      return null;
    }
  }

  async scrapeWebsite() {
    await this.init();

    try {
      // Start with base URL
      this.pendingUrls.push({
        url: this.baseUrl,
        parentUrl: null,
        level: 1,
        isNavigation: true
      });

      while (this.pendingUrls.length > 0 && this.scrapedPages.length < this.maxPages) {
        // Prioritize URLs
        this.pendingUrls = this.navCrawler.prioritizeUrls(this.pendingUrls);
        
        const { url, parentUrl } = this.pendingUrls.shift();

        if (this.visitedUrls.has(url)) continue;
        this.visitedUrls.add(url);

        // Register URL with navigation crawler
        const level = this.navCrawler.registerUrl(url, parentUrl);

        // Scrape page
        const pageData = await this.scrapePage(url, parentUrl);
        
        if (pageData) {
          pageData.level = level;
          this.scrapedPages.push(pageData);
          
          this.onPageComplete(pageData);
          this.onProgress({
            current: this.scrapedPages.length,
            total: Math.min(this.pendingUrls.length + this.scrapedPages.length, this.maxPages),
            url: url,
            level: level
          });
        }

        // Delay between requests
        if (this.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }

      const stats = this.navCrawler.getStats();
      
      return {
        scrapedPages: this.scrapedPages,
        failedPages: this.failedPages,
        statistics: {
          totalPages: this.scrapedPages.length,
          failedPages: this.failedPages.length,
          totalWords: this.scrapedPages.reduce((sum, p) => sum + p.contentLength, 0),
          crawlerStats: stats
        }
      };

    } finally {
      await this.close();
    }
  }
}

module.exports = { EnhancedContentScraper };
