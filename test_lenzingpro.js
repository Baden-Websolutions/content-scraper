/**
 * Test Script: Scrape lenzingpro.com
 * 
 * Max 100 pages, navigation-based crawling, no images
 */

const { EnhancedContentScraper } = require('./core/scraper_enhanced');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Starting lenzingpro.com scraper test...\n');
  console.log('Configuration:');
  console.log('  - Base URL: https://lenzingpro.com');
  console.log('  - Max Pages: 100');
  console.log('  - Download Images: No');
  console.log('  - Navigation-based crawling: Yes\n');

  const scraper = new EnhancedContentScraper({
    baseUrl: 'https://lenzingpro.com',
    maxPages: 100,
    delay: 1000,
    headless: true,
    downloadImages: false,
    onProgress: (data) => {
      console.log(`📄 Progress: ${data.current}/${data.total} | Level ${data.level} | ${data.url}`);
    },
    onPageComplete: (pageData) => {
      console.log(`✅ Completed: ${pageData.title} (${pageData.links.length} links, ${pageData.images.length} images)`);
    },
    onError: (error) => {
      console.error(`❌ Error: ${error.url} - ${error.error}`);
    }
  });

  try {
    const startTime = Date.now();
    
    const result = await scraper.scrapeWebsite();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Scraping Complete!');
    console.log('='.repeat(60));
    console.log(`Total Pages: ${result.statistics.totalPages}`);
    console.log(`Failed Pages: ${result.statistics.failedPages}`);
    console.log(`Total Words: ${result.statistics.totalWords.toLocaleString()}`);
    console.log(`Duration: ${duration}s`);
    console.log('\nCrawler Statistics:');
    console.log(JSON.stringify(result.statistics.crawlerStats, null, 2));

    // Save results
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save full results
    const fullResultPath = path.join(outputDir, `lenzingpro_full_${timestamp}.json`);
    fs.writeFileSync(fullResultPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Full results saved to: ${fullResultPath}`);

    // Save summary
    const summary = {
      baseUrl: 'https://lenzingpro.com',
      scrapedAt: new Date().toISOString(),
      statistics: result.statistics,
      pages: result.scrapedPages.map(p => ({
        url: p.url,
        title: p.title,
        level: p.level,
        linksCount: p.links.length,
        imagesCount: p.images.length,
        contentLength: p.contentLength
      }))
    };

    const summaryPath = path.join(outputDir, `lenzingpro_summary_${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Summary saved to: ${summaryPath}`);

    console.log('\n✨ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
