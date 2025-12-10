/**
 * Content Scraper - Main Scraping Module
 * 
 * Generic website scraper that extracts content from web pages
 * Optimized for Nuxt.js, Storyblok, and SAP Commerce Cloud integration
 * 
 * @module core/scraper
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class ContentScraper {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.maxPages = config.maxPages || 50;
    this.delay = config.delay || 1000;
    this.headless = config.headless !== false;
    this.timeout = config.timeout || 30000;
    this.userAgent = config.userAgent || 'Mozilla/5.0 (compatible; ContentScraper/1.0)';
    
    // Tracking
    this.scrapedPages = [];
    this.failedPages = [];
    this.visitedUrls = new Set();
    this.pendingUrls = [];
    
    // Callbacks for live tracking
    this.onProgress = config.onProgress || (() => {});
    this.onPageComplete = config.onPageComplete || (() => {});
    this.onError = config.onError || (() => {});
  }

  /**
   * Initialize browser instance
   */
  async init() {
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(this.userAgent);
    this.page.setDefaultNavigationTimeout(this.timeout);
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Normalize URL to absolute format
   */
  normalizeUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if URL belongs to the same domain
   */
  isInternalUrl(url) {
    try {
      const urlObj = new URL(url);
      const baseObj = new URL(this.baseUrl);
      return urlObj.hostname === baseObj.hostname;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract links from page content
   */
  extractLinks(html, currentUrl) {
    const $ = cheerio.load(html);
    const links = [];

    $('a').each((i, link) => {
      const href = $(link).attr('href');
      if (!href || href.startsWith('#')) return;

      const absoluteUrl = this.normalizeUrl(href, currentUrl);
      if (absoluteUrl && this.isInternalUrl(absoluteUrl)) {
        const relativePath = absoluteUrl.replace(this.baseUrl, '') || '/';
        links.push({
          text: $(link).text().trim(),
          href: relativePath,
          absoluteUrl: absoluteUrl
        });
      }
    });

    // Remove duplicates
    return links.filter((link, index, self) => 
      index === self.findIndex(l => l.absoluteUrl === link.absoluteUrl)
    );
  }

  /**
   * Extract images from page content
   */
  extractImages(html, currentUrl) {
    const $ = cheerio.load(html);
    const images = [];

    $('img').each((i, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || '';
      const title = $(img).attr('title') || '';

      if (src) {
        const absoluteSrc = this.normalizeUrl(src, currentUrl);
        if (absoluteSrc) {
          images.push({
            src: absoluteSrc,
            alt,
            title,
            width: $(img).attr('width'),
            height: $(img).attr('height')
          });
        }
      }
    });

    return images;
  }

  /**
   * Extract main content from page
   */
  extractContent(html) {
    const $ = cheerio.load(html);
    
    // Remove script, style, and navigation elements
    $('script, style, nav, header, footer, .navigation, .menu').remove();
    
    // Try to find main content area
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      'article',
      'body'
    ];

    let content = '';
    for (const selector of mainSelectors) {
      const element = $(selector).first();
      if (element.length) {
        content = element.text().trim();
        break;
      }
    }

    return content;
  }

  /**
   * Extract metadata from page
   */
  extractMetadata(html) {
    const $ = cheerio.load(html);
    
    return {
      title: $('title').text().trim() || '',
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || ''
    };
  }

  /**
   * Determine page type based on URL and content
   */
  determinePageType(url, content) {
    const urlLower = url.toLowerCase();
    
    if (url === '/' || url === '') return 'homepage';
    if (urlLower.includes('/product') || urlLower.includes('/artikel')) return 'product';
    if (urlLower.includes('/category') || urlLower.includes('/kategorie')) return 'category';
    if (urlLower.includes('/news') || urlLower.includes('/blog')) return 'news';
    if (urlLower.includes('/about') || urlLower.includes('/ueber')) return 'about';
    if (urlLower.includes('/contact') || urlLower.includes('/kontakt')) return 'contact';
    
    return 'default';
  }

  /**
   * Scrape a single page
   */
  async scrapePage(url) {
    try {
      this.onProgress({
        status: 'scraping',
        url,
        progress: this.scrapedPages.length,
        total: this.pendingUrls.length
      });

      await this.page.goto(url, { waitUntil: 'networkidle2' });
      const html = await this.page.content();
      const $ = cheerio.load(html);

      // Extract all data
      const links = this.extractLinks(html, url);
      const images = this.extractImages(html, url);
      const content = this.extractContent(html);
      const metadata = this.extractMetadata(html);
      const relativePath = url.replace(this.baseUrl, '') || '/';
      const pageType = this.determinePageType(relativePath, content);

      // Build page object
      const pageData = {
        url: relativePath,
        absoluteUrl: url,
        title: metadata.title,
        pageType,
        metadata,
        content,
        contentLength: content.split(/\s+/).filter(w => w.length > 0).length,
        links,
        images,
        scrapedAt: new Date().toISOString()
      };

      this.scrapedPages.push(pageData);
      this.visitedUrls.add(url);

      this.onPageComplete(pageData);

      // Add new links to pending queue
      links.forEach(link => {
        if (!this.visitedUrls.has(link.absoluteUrl) && 
            !this.pendingUrls.includes(link.absoluteUrl)) {
          this.pendingUrls.push(link.absoluteUrl);
        }
      });

      return pageData;

    } catch (error) {
      this.failedPages.push({ url, error: error.message });
      this.onError({ url, error: error.message });
      throw error;
    }
  }

  /**
   * Scrape multiple pages starting from base URL
   */
  async scrapeWebsite(startUrl = null) {
    const url = startUrl || this.baseUrl;
    
    try {
      await this.init();

      // Start with the base URL
      this.pendingUrls.push(url);

      while (this.pendingUrls.length > 0 && this.scrapedPages.length < this.maxPages) {
        const currentUrl = this.pendingUrls.shift();
        
        if (this.visitedUrls.has(currentUrl)) continue;

        try {
          await this.scrapePage(currentUrl);
          
          // Delay between requests
          if (this.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
          }
        } catch (error) {
          console.error(`Error scraping ${currentUrl}:`, error.message);
        }
      }

      return {
        success: true,
        scrapedPages: this.scrapedPages,
        failedPages: this.failedPages,
        statistics: {
          totalPages: this.scrapedPages.length,
          failedPages: this.failedPages.length,
          totalWords: this.scrapedPages.reduce((sum, p) => sum + p.contentLength, 0),
          totalLinks: this.scrapedPages.reduce((sum, p) => sum + p.links.length, 0),
          totalImages: this.scrapedPages.reduce((sum, p) => sum + p.images.length, 0)
        }
      };

    } finally {
      await this.close();
    }
  }

  /**
   * Save scraped data to file
   */
  saveToFile(outputPath, data = null) {
    const dataToSave = data || {
      pages: this.scrapedPages,
      failed: this.failedPages,
      statistics: {
        totalPages: this.scrapedPages.length,
        failedPages: this.failedPages.length,
        scrapedAt: new Date().toISOString()
      }
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    return outputPath;
  }
}

module.exports = { ContentScraper };
