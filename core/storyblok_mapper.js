/**
 * Storyblok Mapper Module
 * 
 * Converts enhanced content data to Storyblok story format
 * Generates story files compatible with Storyblok CMS
 * 
 * @module core/storyblok_mapper
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StoryblokMapper {
  constructor(config = {}) {
    this.config = config;
    this.spaceId = config.spaceId || null;
  }

  /**
   * Generate UUID for Storyblok blocks
   */
  generateUuid() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Map a single page to Storyblok story format
   */
  mapToStory(page) {
    const story = {
      story: {
        name: page.title || page.slug,
        slug: page.slug,
        full_slug: page.slug,
        published: false,
        content: {
          _uid: this.generateUuid(),
          component: 'page',
          body: this.buildStoryBody(page)
        },
        meta_data: {
          title: page.enhanced?.seoTitle || page.title,
          description: page.enhanced?.seoDescription || '',
          og_image: page.enhanced?.assets?.hero?.src || '',
          og_title: page.metadata?.ogTitle || page.title,
          og_description: page.metadata?.ogDescription || ''
        }
      }
    };

    return story;
  }

  /**
   * Build Storyblok body blocks from page content
   */
  buildStoryBody(page) {
    const body = [];

    // Hero section
    if (page.enhanced?.assets?.hero) {
      body.push({
        _uid: this.generateUuid(),
        component: 'hero',
        title: page.enhanced.primaryHeading || page.title,
        subtitle: page.enhanced.excerpt || '',
        background_image: {
          filename: page.enhanced.assets.hero.src,
          alt: page.enhanced.assets.hero.alt
        }
      });
    }

    // Rich text content section
    if (page.enhanced?.structuredContent) {
      const sections = page.enhanced.structuredContent.sections || [];
      
      sections.forEach(section => {
        body.push({
          _uid: this.generateUuid(),
          component: 'rich_text_section',
          heading: section.heading || '',
          content: section.content.join('\n\n')
        });
      });

      // If no sections, add raw content
      if (sections.length === 0 && page.content) {
        body.push({
          _uid: this.generateUuid(),
          component: 'rich_text_section',
          heading: '',
          content: page.content
        });
      }
    }

    // Image gallery
    if (page.enhanced?.assets?.gallery && page.enhanced.assets.gallery.length > 0) {
      body.push({
        _uid: this.generateUuid(),
        component: 'image_gallery',
        images: page.enhanced.assets.gallery.map(img => ({
          filename: img.src,
          alt: img.alt,
          title: img.title
        }))
      });
    }

    // Related links
    if (page.enhanced?.relatedLinks?.content && page.enhanced.relatedLinks.content.length > 0) {
      body.push({
        _uid: this.generateUuid(),
        component: 'link_list',
        title: 'Related Content',
        links: page.enhanced.relatedLinks.content.slice(0, 5).map(link => ({
          text: link.text,
          url: link.href
        }))
      });
    }

    return body;
  }

  /**
   * Map all pages to Storyblok stories
   */
  mapAll(pages) {
    console.log(`[StoryblokMapper] Mapping ${pages.length} pages to Storyblok format...`);
    
    const stories = pages.map(page => this.mapToStory(page));
    
    console.log(`[StoryblokMapper] Mapping complete.`);
    return stories;
  }

  /**
   * Save stories to individual files
   */
  saveStories(stories, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const savedFiles = [];

    stories.forEach(storyWrapper => {
      const story = storyWrapper.story;
      const fileName = `${story.slug}.story.json`;
      const filePath = path.join(outputDir, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(storyWrapper, null, 2), 'utf-8');
      savedFiles.push(filePath);
      
      console.log(`[StoryblokMapper] Story saved: ${fileName}`);
    });

    // Save index file
    const indexPath = path.join(outputDir, 'stories.json');
    fs.writeFileSync(indexPath, JSON.stringify(stories, null, 2), 'utf-8');
    console.log(`[StoryblokMapper] Index saved: stories.json (${stories.length} stories)`);

    return {
      stories: savedFiles,
      index: indexPath
    };
  }

  /**
   * Generate Storyblok space configuration
   */
  generateSpaceConfig(stories) {
    return {
      space_id: this.spaceId,
      stories_count: stories.length,
      components: this.extractComponents(stories),
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Extract unique components used in stories
   */
  extractComponents(stories) {
    const components = new Set();
    
    stories.forEach(storyWrapper => {
      const story = storyWrapper.story;
      if (story.content?.component) {
        components.add(story.content.component);
      }
      if (story.content?.body) {
        story.content.body.forEach(block => {
          if (block.component) {
            components.add(block.component);
          }
        });
      }
    });

    return Array.from(components);
  }
}

module.exports = { StoryblokMapper };
