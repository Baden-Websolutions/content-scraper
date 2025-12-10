/**
 * Nuxt Component Generator Module
 * 
 * Generates Nuxt.js Vue components from scraped content
 * Creates ready-to-use .vue files for Nuxt applications
 * 
 * @module core/nuxt_generator
 */

const fs = require('fs');
const path = require('path');

class NuxtGenerator {
  constructor(config = {}) {
    this.config = config;
    this.componentStyle = config.componentStyle || 'composition'; // 'composition' or 'options'
  }

  /**
   * Generate Vue component template
   */
  generateTemplate(page) {
    const hasHero = page.enhanced?.assets?.hero;
    const hasGallery = page.enhanced?.assets?.gallery && page.enhanced.assets.gallery.length > 0;
    
    return `<template>
  <div class="page-container" :class="'page-type-' + pageType">
    <Head>
      <Title>{{ pageData.title }}</Title>
      <Meta name="description" :content="pageData.enhanced?.seoDescription || ''" />
    </Head>

    <!-- Hero Section -->
    <section v-if="heroImage" class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">{{ pageData.enhanced?.primaryHeading || pageData.title }}</h1>
        <p v-if="pageData.enhanced?.excerpt" class="hero-excerpt">
          {{ pageData.enhanced.excerpt }}
        </p>
      </div>
      <img 
        :src="heroImage.src" 
        :alt="heroImage.alt" 
        class="hero-image"
      />
    </section>

    <!-- Main Content -->
    <main class="main-content">
      <article class="content-article">
        <!-- Structured Content Sections -->
        <section 
          v-for="(section, index) in contentSections" 
          :key="index"
          class="content-section"
        >
          <h2 v-if="section.heading" class="section-heading">
            {{ section.heading }}
          </h2>
          <div class="section-content">
            <p v-for="(para, pIndex) in section.content" :key="pIndex">
              {{ para }}
            </p>
          </div>
        </section>

        <!-- Fallback: Raw Content -->
        <div v-if="contentSections.length === 0" class="raw-content">
          <p v-for="(para, index) in rawParagraphs" :key="index">
            {{ para }}
          </p>
        </div>
      </article>

      <!-- Image Gallery -->
      <section v-if="gallery.length > 0" class="image-gallery">
        <h2 class="gallery-title">Gallery</h2>
        <div class="gallery-grid">
          <div 
            v-for="(image, index) in gallery" 
            :key="index"
            class="gallery-item"
          >
            <img 
              :src="image.src" 
              :alt="image.alt || 'Gallery image'" 
              class="gallery-image"
            />
          </div>
        </div>
      </section>

      <!-- Related Links -->
      <section v-if="relatedLinks.length > 0" class="related-links">
        <h2 class="related-title">Related Content</h2>
        <ul class="links-list">
          <li v-for="(link, index) in relatedLinks" :key="index">
            <NuxtLink :to="link.href" class="related-link">
              {{ link.text }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>

    <!-- Metadata Footer -->
    <footer class="page-footer">
      <div class="metadata">
        <span v-if="pageData.enhanced?.readingTime" class="reading-time">
          {{ pageData.enhanced.readingTime.text }}
        </span>
        <span class="word-count">
          {{ pageData.contentLength }} words
        </span>
        <span class="scraped-date">
          Scraped: {{ new Date(pageData.scrapedAt).toLocaleDateString() }}
        </span>
      </div>
    </footer>
  </div>
</template>`;
  }

  /**
   * Generate Vue component script (Composition API)
   */
  generateScriptComposition(page) {
    return `
<script setup>
const pageData = ${JSON.stringify(page, null, 2)};

const pageType = computed(() => pageData.pageType || 'default');

const heroImage = computed(() => 
  pageData.enhanced?.assets?.hero || null
);

const contentSections = computed(() => 
  pageData.enhanced?.structuredContent?.sections || []
);

const rawParagraphs = computed(() => {
  if (contentSections.value.length > 0) return [];
  return pageData.content?.split('\\n').filter(p => p.trim().length > 0) || [];
});

const gallery = computed(() => 
  pageData.enhanced?.assets?.gallery || []
);

const relatedLinks = computed(() => 
  pageData.enhanced?.relatedLinks?.content?.slice(0, 5) || []
);
</script>`;
  }

  /**
   * Generate Vue component script (Options API)
   */
  generateScriptOptions(page) {
    return `
<script>
export default {
  data() {
    return {
      pageData: ${JSON.stringify(page, null, 2)}
    };
  },
  computed: {
    pageType() {
      return this.pageData.pageType || 'default';
    },
    heroImage() {
      return this.pageData.enhanced?.assets?.hero || null;
    },
    contentSections() {
      return this.pageData.enhanced?.structuredContent?.sections || [];
    },
    rawParagraphs() {
      if (this.contentSections.length > 0) return [];
      return this.pageData.content?.split('\\n').filter(p => p.trim().length > 0) || [];
    },
    gallery() {
      return this.pageData.enhanced?.assets?.gallery || [];
    },
    relatedLinks() {
      return this.pageData.enhanced?.relatedLinks?.content?.slice(0, 5) || [];
    }
  }
};
</script>`;
  }

  /**
   * Generate Vue component styles
   */
  generateStyles() {
    return `
<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Hero Section */
.hero-section {
  position: relative;
  margin-bottom: 40px;
  border-radius: 8px;
  overflow: hidden;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 20px;
  color: #1a1a1a;
}

.hero-excerpt {
  font-size: 1.2rem;
  color: #666;
  line-height: 1.6;
}

.hero-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

/* Main Content */
.main-content {
  margin-bottom: 60px;
}

.content-article {
  line-height: 1.8;
  color: #333;
}

.content-section {
  margin-bottom: 40px;
}

.section-heading {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 10px;
}

.section-content p,
.raw-content p {
  margin-bottom: 15px;
  text-align: justify;
}

/* Image Gallery */
.image-gallery {
  margin: 60px 0;
}

.gallery-title {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 30px;
  color: #1a1a1a;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.gallery-item {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.gallery-item:hover {
  transform: translateY(-5px);
}

.gallery-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

/* Related Links */
.related-links {
  margin: 60px 0;
  padding: 30px;
  background: #f9f9f9;
  border-radius: 8px;
}

.related-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
}

.links-list {
  list-style: none;
  padding: 0;
}

.links-list li {
  margin-bottom: 10px;
}

.related-link {
  color: #0066cc;
  text-decoration: none;
  transition: color 0.2s ease;
}

.related-link:hover {
  color: #004499;
  text-decoration: underline;
}

/* Footer */
.page-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 20px;
  margin-top: 60px;
}

.metadata {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: #666;
}

.metadata span {
  padding: 5px 10px;
  background: #f0f0f0;
  border-radius: 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero-title {
    font-size: 1.8rem;
  }
  
  .hero-excerpt {
    font-size: 1rem;
  }
  
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .metadata {
    flex-direction: column;
    gap: 10px;
  }
}
</style>`;
  }

  /**
   * Generate complete Vue component
   */
  generateComponent(page) {
    const template = this.generateTemplate(page);
    const script = this.componentStyle === 'composition' 
      ? this.generateScriptComposition(page)
      : this.generateScriptOptions(page);
    const styles = this.generateStyles();

    return `${template}\n${script}\n${styles}`;
  }

  /**
   * Generate components for all pages
   */
  generateAll(pages, outputDir) {
    console.log(`[NuxtGenerator] Generating ${pages.length} Nuxt components...`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedFiles = [];

    pages.forEach(page => {
      const fileName = `${page.slug || 'page'}.vue`;
      const filePath = path.join(outputDir, fileName);
      const component = this.generateComponent(page);

      fs.writeFileSync(filePath, component, 'utf-8');
      generatedFiles.push(filePath);

      console.log(`[NuxtGenerator] Component generated: ${fileName}`);
    });

    console.log(`[NuxtGenerator] Generation complete. ${generatedFiles.length} components created.`);
    return generatedFiles;
  }

  /**
   * Generate Nuxt routes configuration
   */
  generateRoutesConfig(pages, outputPath) {
    const routes = pages.map(page => ({
      path: page.url === '/' ? '/' : `/${page.slug}`,
      component: `${page.slug}.vue`,
      name: page.slug,
      meta: {
        title: page.title,
        description: page.enhanced?.seoDescription || ''
      }
    }));

    const config = {
      routes,
      generated_at: new Date().toISOString(),
      total_routes: routes.length
    };

    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[NuxtGenerator] Routes config saved: ${outputPath}`);

    return config;
  }
}

module.exports = { NuxtGenerator };
