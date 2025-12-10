/**
 * Example Configuration File
 * 
 * Copy this file to config.js and customize for your needs
 */

module.exports = {
  // Scraper Configuration
  scraper: {
    baseUrl: 'https://lenzingpro.com',
    maxPages: 50,
    delay: 1000,
    headless: true,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (compatible; ContentScraper/1.0)'
  },

  // Output Configuration
  output: {
    directory: './output',
    formats: ['json', 'storyblok', 'nuxt', 'sap-cc', 'sitemap'],
    downloadImages: true
  },

  // Image Downloader Configuration
  images: {
    outputDir: './output/images',
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000
  },

  // Storyblok Configuration
  storyblok: {
    spaceId: null, // Your Storyblok space ID
    components: {
      page: 'page',
      hero: 'hero',
      richText: 'rich_text_section',
      gallery: 'image_gallery',
      links: 'link_list'
    }
  },

  // Nuxt.js Configuration
  nuxt: {
    componentStyle: 'composition', // 'composition' or 'options'
    outputDir: './output/nuxt-components'
  },

  // SAP Commerce Cloud Configuration
  sapCC: {
    catalogId: 'contentCatalog',
    catalogVersion: 'Online',
    language: 'en',
    outputDir: './output/sap-commerce'
  },

  // Sitemap Configuration
  sitemap: {
    changefreq: 'weekly',
    priority: 0.5
  },

  // Server Configuration
  server: {
    port: 3000,
    host: 'localhost'
  }
};
