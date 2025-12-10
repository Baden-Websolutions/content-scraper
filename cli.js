#!/usr/bin/env node

/**
 * Content Scraper CLI
 * 
 * Command-line interface for the content scraper
 * Provides interactive and non-interactive modes
 * 
 * @module cli
 */

const { ContentScraper } = require('./core/scraper');
const { ContentEnhancer } = require('./core/enhancer');
const { StoryblokMapper } = require('./core/storyblok_mapper');
const { NuxtGenerator } = require('./core/nuxt_generator');
const { SAPCCAdapter } = require('./core/sap_cc_adapter');
const { SitemapGenerator } = require('./utils/sitemap_generator');
const { ImageDownloader } = require('./utils/image_downloader');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ContentScraperCLI {
  constructor() {
    this.config = {
      baseUrl: '',
      maxPages: 50,
      delay: 1000,
      outputDir: './output',
      formats: ['json', 'storyblok', 'nuxt', 'sitemap']
    };
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Ask question and get user input
   */
  async ask(question, defaultValue = '') {
    return new Promise((resolve) => {
      const prompt = defaultValue 
        ? `${question} [${defaultValue}]: `
        : `${question}: `;
      
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  /**
   * Display welcome banner
   */
  displayBanner() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           Content Scraper - Universal Web Crawler         ║');
    console.log('║     Optimized for Nuxt.js, Storyblok & SAP Commerce       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * Interactive configuration
   */
  async interactiveConfig() {
    console.log('📋 Configuration\n');

    this.config.baseUrl = await this.ask('Base URL (e.g., https://example.com)');
    
    if (!this.config.baseUrl) {
      console.error('❌ Base URL is required!');
      process.exit(1);
    }

    const maxPages = await this.ask('Maximum pages to scrape', '50');
    this.config.maxPages = parseInt(maxPages) || 50;

    const delay = await this.ask('Delay between requests (ms)', '1000');
    this.config.delay = parseInt(delay) || 1000;

    this.config.outputDir = await this.ask('Output directory', './output');

    const downloadImages = await this.ask('Download images? (y/n)', 'n');
    this.config.downloadImages = downloadImages.toLowerCase() === 'y';

    console.log('\n📦 Export Formats:');
    console.log('1. Raw JSON');
    console.log('2. Storyblok Stories');
    console.log('3. Nuxt.js Components');
    console.log('4. SAP Commerce Cloud');
    console.log('5. XML Sitemap');
    console.log('6. All formats');

    const formatChoice = await this.ask('Select formats (comma-separated, e.g., 1,2,3)', '6');
    this.config.formats = this.parseFormatChoice(formatChoice);

    console.log('\n✅ Configuration complete!\n');
  }

  /**
   * Parse format choice
   */
  parseFormatChoice(choice) {
    const formats = [];
    const choices = choice.split(',').map(c => c.trim());

    if (choices.includes('6')) {
      return ['json', 'storyblok', 'nuxt', 'sap-cc', 'sitemap'];
    }

    if (choices.includes('1')) formats.push('json');
    if (choices.includes('2')) formats.push('storyblok');
    if (choices.includes('3')) formats.push('nuxt');
    if (choices.includes('4')) formats.push('sap-cc');
    if (choices.includes('5')) formats.push('sitemap');

    return formats;
  }

  /**
   * Display progress
   */
  displayProgress(data) {
    const percentage = data.total > 0 
      ? Math.round((data.progress / data.total) * 100)
      : 0;
    
    process.stdout.write(`\r🔄 Scraping: ${data.url.substring(0, 60)}... [${data.progress}/${data.total}] ${percentage}%`);
  }

  /**
   * Run the scraper
   */
  async run() {
    try {
      this.displayBanner();
      await this.interactiveConfig();

      console.log('🚀 Starting scraper...\n');

      // Initialize scraper
      const scraper = new ContentScraper({
        baseUrl: this.config.baseUrl,
        maxPages: this.config.maxPages,
        delay: this.config.delay,
        onProgress: (data) => this.displayProgress(data),
        onPageComplete: (page) => {
          console.log(`\n✓ Completed: ${page.title} (${page.contentLength} words)`);
        },
        onError: (error) => {
          console.error(`\n✗ Error: ${error.url} - ${error.error}`);
        }
      });

      // Scrape website
      const result = await scraper.scrapeWebsite();
      
      console.log('\n\n📊 Scraping Statistics:');
      console.log(`   Total pages: ${result.statistics.totalPages}`);
      console.log(`   Failed pages: ${result.statistics.failedPages}`);
      console.log(`   Total words: ${result.statistics.totalWords}`);
      console.log(`   Total links: ${result.statistics.totalLinks}`);
      console.log(`   Total images: ${result.statistics.totalImages}`);

      // Save raw data
      const rawDataPath = path.join(this.config.outputDir, 'raw_data.json');
      scraper.saveToFile(rawDataPath);
      console.log(`\n💾 Raw data saved: ${rawDataPath}`);

      // Enhance data
      console.log('\n🔧 Enhancing data...');
      const enhancer = new ContentEnhancer({
        assetBaseUrl: this.config.baseUrl
      });
      const enhancedPages = enhancer.enhanceAll(result.scrapedPages);
      const enhancedPath = path.join(this.config.outputDir, 'enhanced_data.json');
      enhancer.saveToFile({ pages: enhancedPages }, enhancedPath);

      // Download images
      if (this.config.downloadImages) {
        console.log('\n📥 Downloading images...');
        const imageDownloader = new ImageDownloader({
          outputDir: path.join(this.config.outputDir, 'images')
        });
        
        const imageResults = await imageDownloader.downloadAllImages(
          enhancedPages,
          (progress) => {
            process.stdout.write(`\r   Downloading: ${progress.current}/${progress.total}`);
          }
        );
        
        console.log(`\n   ✓ Downloaded: ${imageResults.success.length} images`);
        console.log(`   ✗ Failed: ${imageResults.failed.length} images`);
        
        const manifestPath = path.join(this.config.outputDir, 'images', 'manifest.json');
        imageDownloader.generateManifest(manifestPath);
      }

      // Export formats
      console.log('\n📤 Exporting formats...');

      if (this.config.formats.includes('storyblok')) {
        const storyblokMapper = new StoryblokMapper();
        const stories = storyblokMapper.mapAll(enhancedPages);
        const storyblokDir = path.join(this.config.outputDir, 'storyblok');
        storyblokMapper.saveStories(stories, storyblokDir);
        console.log(`   ✓ Storyblok stories: ${storyblokDir}`);
      }

      if (this.config.formats.includes('nuxt')) {
        const nuxtGenerator = new NuxtGenerator({
          componentStyle: 'composition'
        });
        const nuxtDir = path.join(this.config.outputDir, 'nuxt-components');
        nuxtGenerator.generateAll(enhancedPages, nuxtDir);
        
        const routesPath = path.join(this.config.outputDir, 'nuxt-routes.json');
        nuxtGenerator.generateRoutesConfig(enhancedPages, routesPath);
        console.log(`   ✓ Nuxt components: ${nuxtDir}`);
      }

      if (this.config.formats.includes('sap-cc')) {
        const sapAdapter = new SAPCCAdapter({
          catalogId: 'contentCatalog',
          catalogVersion: 'Online'
        });
        const sapData = sapAdapter.convertAll(enhancedPages);
        const sapDir = path.join(this.config.outputDir, 'sap-commerce');
        sapAdapter.saveToFiles(sapData, sapDir);
        console.log(`   ✓ SAP Commerce Cloud: ${sapDir}`);
      }

      if (this.config.formats.includes('sitemap')) {
        const sitemapGenerator = new SitemapGenerator({
          baseUrl: this.config.baseUrl
        });
        const sitemapPath = path.join(this.config.outputDir, 'sitemap.xml');
        sitemapGenerator.saveToFile(enhancedPages, sitemapPath);
        console.log(`   ✓ Sitemap: ${sitemapPath}`);
      }

      console.log('\n✅ All tasks completed successfully!\n');
      console.log(`📁 Output directory: ${path.resolve(this.config.outputDir)}\n`);

    } catch (error) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Parse command-line arguments
   */
  parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--url' && args[i + 1]) {
        this.config.baseUrl = args[i + 1];
        i++;
      } else if (arg === '--max-pages' && args[i + 1]) {
        this.config.maxPages = parseInt(args[i + 1]);
        i++;
      } else if (arg === '--delay' && args[i + 1]) {
        this.config.delay = parseInt(args[i + 1]);
        i++;
      } else if (arg === '--output' && args[i + 1]) {
        this.config.outputDir = args[i + 1];
        i++;
      } else if (arg === '--help' || arg === '-h') {
        this.displayHelp();
        process.exit(0);
      }
    }
  }

  /**
   * Display help
   */
  displayHelp() {
    console.log(`
Content Scraper CLI

Usage:
  node cli.js [options]

Options:
  --url <url>          Base URL to scrape
  --max-pages <n>      Maximum pages to scrape (default: 50)
  --delay <ms>         Delay between requests in ms (default: 1000)
  --output <dir>       Output directory (default: ./output)
  --help, -h           Show this help message

Interactive Mode:
  Run without arguments to enter interactive configuration mode.

Examples:
  node cli.js
  node cli.js --url https://example.com --max-pages 100
  node cli.js --url https://example.com --output ./my-output
`);
  }
}

// Run CLI
if (require.main === module) {
  const cli = new ContentScraperCLI();
  cli.parseArgs();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { ContentScraperCLI };
