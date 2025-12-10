/**
 * Example Usage of Content Scraper
 * 
 * This file demonstrates various ways to use the content scraper
 */

const { scrapeAndExport, ContentScraper, NuxtGenerator } = require('./index');

// Example 1: Simple scraping with all exports
async function example1() {
  console.log('Example 1: Full scraping pipeline\n');
  
  const result = await scrapeAndExport({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 10,
    delay: 1000,
    formats: ['json', 'storyblok', 'nuxt', 'sitemap'],
    outputDir: './output/example1',
    onProgress: (progress) => {
      console.log(`Progress: ${progress.current}/${progress.total} - ${progress.url}`);
    }
  });

  console.log('\nResults:');
  console.log(`- Pages scraped: ${result.statistics.totalPages}`);
  console.log(`- Total words: ${result.statistics.totalWords}`);
  console.log(`- Exports created: ${Object.keys(result.exports).join(', ')}`);
}

// Example 2: Custom scraping with manual processing
async function example2() {
  console.log('Example 2: Custom scraping\n');
  
  const scraper = new ContentScraper({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 5,
    delay: 500,
    onPageComplete: (page) => {
      console.log(`✓ Scraped: ${page.title} (${page.contentLength} words)`);
    }
  });

  const result = await scraper.scrapeWebsite();
  
  // Custom processing
  const homePage = result.scrapedPages.find(p => p.url === '/');
  console.log('\nHome page content preview:');
  console.log(homePage.content.substring(0, 200) + '...');
}

// Example 3: Generate only Nuxt components
async function example3() {
  console.log('Example 3: Nuxt.js components only\n');
  
  const scraper = new ContentScraper({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 10
  });

  const result = await scraper.scrapeWebsite();
  
  const generator = new NuxtGenerator({
    componentStyle: 'composition'
  });

  const files = generator.generateAll(result.scrapedPages, './output/example3/components');
  console.log(`Generated ${files.length} Vue components`);
}

// Run examples
async function main() {
  try {
    // Uncomment the example you want to run
    
    // await example1();
    // await example2();
    // await example3();
    
    console.log('\nUncomment an example in example.js to run it!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
