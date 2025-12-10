/**
 * Content Scraper - Main Entry Point
 * 
 * Universal web content scraper optimized for:
 * - Nuxt.js applications
 * - Storyblok CMS
 * - SAP Commerce Cloud (Hybris)
 * 
 * @module content-scraper
 */

const { ContentScraper } = require('./core/scraper');
const { ContentEnhancer } = require('./core/enhancer');
const { StoryblokMapper } = require('./core/storyblok_mapper');
const { NuxtGenerator } = require('./core/nuxt_generator');
const { SAPCCAdapter } = require('./core/sap_cc_adapter');
const { SitemapGenerator } = require('./utils/sitemap_generator');
const { ImageDownloader } = require('./utils/image_downloader');

/**
 * Main scraper function - simplified API
 */
async function scrape(config) {
  const scraper = new ContentScraper(config);
  const result = await scraper.scrapeWebsite();
  return result;
}

/**
 * Full pipeline: scrape, enhance, and export
 */
async function scrapeAndExport(config) {
  const {
    baseUrl,
    maxPages = 50,
    delay = 1000,
    outputDir = './output',
    formats = ['json'],
    downloadImages = false,
    onProgress = null
  } = config;

  // Scrape
  const scraper = new ContentScraper({
    baseUrl,
    maxPages,
    delay,
    onProgress: onProgress || (() => {})
  });

  const result = await scraper.scrapeWebsite();

  // Enhance
  const enhancer = new ContentEnhancer({ assetBaseUrl: baseUrl });
  const enhancedPages = enhancer.enhanceAll(result.scrapedPages);

  // Export
  const exports = {};

  if (formats.includes('json')) {
    const path = require('path');
    const jsonPath = path.join(outputDir, 'data.json');
    scraper.saveToFile(jsonPath, { pages: enhancedPages });
    exports.json = jsonPath;
  }

  if (formats.includes('storyblok')) {
    const mapper = new StoryblokMapper();
    const stories = mapper.mapAll(enhancedPages);
    const path = require('path');
    const storyblokDir = path.join(outputDir, 'storyblok');
    exports.storyblok = mapper.saveStories(stories, storyblokDir);
  }

  if (formats.includes('nuxt')) {
    const generator = new NuxtGenerator();
    const path = require('path');
    const nuxtDir = path.join(outputDir, 'nuxt');
    exports.nuxt = generator.generateAll(enhancedPages, nuxtDir);
  }

  if (formats.includes('sap-cc')) {
    const adapter = new SAPCCAdapter();
    const sapData = adapter.convertAll(enhancedPages);
    const path = require('path');
    const sapDir = path.join(outputDir, 'sap-cc');
    exports.sapCC = adapter.saveToFiles(sapData, sapDir);
  }

  if (formats.includes('sitemap')) {
    const sitemapGen = new SitemapGenerator({ baseUrl });
    const path = require('path');
    const sitemapPath = path.join(outputDir, 'sitemap.xml');
    exports.sitemap = sitemapGen.saveToFile(enhancedPages, sitemapPath);
  }

  if (downloadImages) {
    const imageDownloader = new ImageDownloader({
      outputDir: require('path').join(outputDir, 'images')
    });
    const imageResults = await imageDownloader.downloadAllImages(enhancedPages);
    exports.images = imageResults;
  }

  return {
    pages: enhancedPages,
    statistics: result.statistics,
    exports
  };
}

module.exports = {
  scrape,
  scrapeAndExport,
  ContentScraper,
  ContentEnhancer,
  StoryblokMapper,
  NuxtGenerator,
  SAPCCAdapter,
  SitemapGenerator,
  ImageDownloader
};
