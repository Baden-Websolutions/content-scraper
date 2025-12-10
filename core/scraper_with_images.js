/**
 * Content Scraper with Enhanced Image Download
 * 
 * Integrates navigation-based crawling with intelligent image downloading
 * 
 * @module core/scraper_with_images
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { NavigationCrawler } = require('./navigation_crawler');
const { EnhancedImageDownloader } = require('../utils/image_downloader_enhanced');

class ContentScraperWithImages {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.maxPages = config.maxPages || 100;
    this.delay = config.delay || 1000;
    this.headless = config.headless !== false;
    this.timeout = config.timeout || 30000;
    this.userAgent = config.userAgent || 'Mozilla/5.0 (compatible; ContentScraper/1.0)';
    this.downloadImages = config.downloadImages !== false; // Default: true
    this.outputDir = config.outputDir || './output';
    
    // Navigation crawler
    this.navCrawler = new NavigationCrawler({
      maxLevel: config.maxLevel || 3,
      levelLimits: config.levelLimits || {
        1: -1,  // All level 1 pages
        2: -1,  // All level 2 pages
        3: 1    // Only 1 level 3 page per category
      }
    });
    
    // Image downloader
    if (this.downloadImages) {
      this.imageDownloader = new EnhancedImageDownloader({
        outputDir: path.join(this.outputDir, 'images'),
        maxSize: config.maxImageSize || 10 * 1024 * 1024,
        timeout: config.imageTimeout || 30000
      });
    }
    
    // Tracking
    this.scrapedPages = [];
    this.failedPages = [];
    this.visitedUrls = new Set();
    this.pendingUrls = [];
    
    // Callbacks
    this.onProgress = config.onProgress || (() => {});
    this.onPageComplete = config.onPageComplete || (() => {});
    this.onError = config.onError || (() => {});
    this.onImageProgress = config.onImageProgress || (() => {});
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

      // Extract images with full metadata
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        const alt = $(img).attr('alt') || '';
        const title = $(img).attr('title') || '';
        const width = $(img).attr('width') || '';
        const height = $(img).attr('height') || '';
        
        if (src) {
          const absoluteSrc = this.normalizeUrl(src, url);
          if (absoluteSrc) {
            pageData.images.push({
              src: absoluteSrc,
              alt: alt,
              title: title,
              width: width,
              height: height,
              pageUrl: url
            });
          }
        }
      });

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
      // Phase 1: Scrape pages
      console.log('\n=== Phase 1: Scraping Pages ===\n');
      
      this.pendingUrls.push({
        url: this.baseUrl,
        parentUrl: null,
        level: 1,
        isNavigation: true
      });

      while (this.pendingUrls.length > 0 && this.scrapedPages.length < this.maxPages) {
        this.pendingUrls = this.navCrawler.prioritizeUrls(this.pendingUrls);
        
        const { url, parentUrl } = this.pendingUrls.shift();

        if (this.visitedUrls.has(url)) continue;
        this.visitedUrls.add(url);

        const level = this.navCrawler.registerUrl(url, parentUrl);

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

        if (this.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }

      // Phase 2: Download images (if enabled)
      let imageResults = null;
      if (this.downloadImages && this.imageDownloader) {
        console.log('\n=== Phase 2: Downloading Images ===\n');
        
        imageResults = await this.imageDownloader.downloadAllImages(
          this.scrapedPages,
          this.baseUrl,
          this.onImageProgress
        );

        // Update pages with local image paths
        this.scrapedPages = this.imageDownloader.updatePagesWithLocalPaths(this.scrapedPages);
      }

      // Generate results
      const stats = this.navCrawler.getStats();
      
      const result = {
        baseUrl: this.baseUrl,
        scrapedAt: new Date().toISOString(),
        scrapedPages: this.scrapedPages,
        failedPages: this.failedPages,
        statistics: {
          totalPages: this.scrapedPages.length,
          failedPages: this.failedPages.length,
          totalWords: this.scrapedPages.reduce((sum, p) => sum + p.contentLength, 0),
          crawlerStats: stats
        }
      };

      // Add image statistics if downloaded
      if (imageResults) {
        result.imageResults = imageResults;
        result.statistics.images = imageResults.statistics;
      }

      return result;

    } finally {
      await this.close();
    }
  }

  /**
   * Save results with images to JSON
   */
  async saveResults(result, outputPath) {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save main results
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ Results saved to: ${outputPath}`);

    // Save image manifest if images were downloaded
    if (result.imageResults && this.imageDownloader) {
      const manifestPath = outputPath.replace('.json', '_image_manifest.json');
      this.imageDownloader.generateManifest(manifestPath);
    }

    return outputPath;
  }
}

module.exports = { ContentScraperWithImages };
