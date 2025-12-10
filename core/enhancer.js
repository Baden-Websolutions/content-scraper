/**
 * Content Enhancer Module
 * 
 * Enriches scraped data with additional metadata and structure
 * Prepares content for CMS integration (Storyblok, Strapi, etc.)
 * 
 * @module core/enhancer
 */

const fs = require('fs');
const path = require('path');

class ContentEnhancer {
  constructor(config = {}) {
    this.config = config;
    this.assetBaseUrl = config.assetBaseUrl || '';
  }

  /**
   * Enhance a single page with additional metadata
   */
  enhancePage(page, index = 0) {
    const slug = this.generateSlug(page.url, index);
    
    return {
      ...page,
      slug,
      enhanced: {
        component: this.determineComponent(page.pageType),
        seoTitle: page.metadata.title || page.title,
        seoDescription: page.metadata.description,
        primaryHeading: this.extractPrimaryHeading(page.content),
        excerpt: this.generateExcerpt(page.content),
        readingTime: this.calculateReadingTime(page.contentLength),
        assets: this.organizeAssets(page.images),
        structuredContent: this.structureContent(page.content),
        relatedLinks: this.categorizeLinks(page.links)
      }
    };
  }

  /**
   * Generate URL slug from page URL
   */
  generateSlug(url, index) {
    try {
      let slug = url.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!slug) return 'home';
      
      slug = slug
        .replace(/[^a-zA-Z0-9\-/]+/g, '-')
        .replace(/\/+|\s+/g, '-')
        .toLowerCase();
      
      return slug || `page-${index}`;
    } catch {
      return `page-${index}`;
    }
  }

  /**
   * Determine CMS component type based on page type
   */
  determineComponent(pageType) {
    const componentMap = {
      'homepage': 'page.home',
      'product': 'page.product',
      'category': 'page.category',
      'news': 'page.news',
      'about': 'page.about',
      'contact': 'page.contact',
      'default': 'page.default'
    };
    
    return componentMap[pageType] || 'page.default';
  }

  /**
   * Extract primary heading from content
   */
  extractPrimaryHeading(content) {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines[0] || '';
  }

  /**
   * Generate excerpt from content
   */
  generateExcerpt(content, maxLength = 200) {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    
    return cleaned.substring(0, maxLength).trim() + '...';
  }

  /**
   * Calculate reading time based on word count
   */
  calculateReadingTime(wordCount) {
    const wordsPerMinute = 200;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return {
      minutes,
      text: `${minutes} min read`
    };
  }

  /**
   * Organize images into structured assets
   */
  organizeAssets(images) {
    const assets = {
      hero: null,
      gallery: [],
      thumbnails: [],
      all: images
    };

    if (images.length > 0) {
      // First image as hero
      assets.hero = images[0];
      
      // Rest as gallery
      assets.gallery = images.slice(1);
      
      // Generate thumbnails list
      assets.thumbnails = images.map(img => ({
        src: img.src,
        alt: img.alt,
        thumbnail: img.src // In production, this would be a thumbnail URL
      }));
    }

    return assets;
  }

  /**
   * Structure content into sections
   */
  structureContent(content) {
    const paragraphs = content
      .split('\n')
      .filter(p => p.trim().length > 0)
      .map(p => p.trim());

    return {
      raw: content,
      paragraphs,
      sections: this.detectSections(paragraphs)
    };
  }

  /**
   * Detect sections in content based on patterns
   */
  detectSections(paragraphs) {
    const sections = [];
    let currentSection = null;

    paragraphs.forEach(para => {
      // Simple heuristic: if paragraph is short and uppercase-heavy, it might be a heading
      const isHeading = para.length < 100 && para.split('').filter(c => c === c.toUpperCase()).length > para.length * 0.5;
      
      if (isHeading) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: para,
          content: []
        };
      } else if (currentSection) {
        currentSection.content.push(para);
      } else {
        // Content before first heading
        if (sections.length === 0) {
          sections.push({
            heading: '',
            content: [para]
          });
        }
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Categorize links by type
   */
  categorizeLinks(links) {
    const categorized = {
      internal: [],
      navigation: [],
      content: []
    };

    links.forEach(link => {
      categorized.internal.push(link);
      
      // Heuristic: short text might be navigation
      if (link.text.length < 30) {
        categorized.navigation.push(link);
      } else {
        categorized.content.push(link);
      }
    });

    return categorized;
  }

  /**
   * Enhance all pages in dataset
   */
  enhanceAll(pages) {
    console.log(`[ContentEnhancer] Enhancing ${pages.length} pages...`);
    
    const enhanced = pages.map((page, index) => this.enhancePage(page, index));
    
    console.log(`[ContentEnhancer] Enhancement complete.`);
    return enhanced;
  }

  /**
   * Save enhanced data to file
   */
  saveToFile(data, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[ContentEnhancer] Enhanced data saved to: ${outputPath}`);
    return outputPath;
  }
}

module.exports = { ContentEnhancer };
