/**
 * Content Scraper Web UI Server
 * 
 * Express server with WebSocket support for live tracking
 * Provides web interface for scraper control and monitoring
 * 
 * @module server
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { scrapeAndExport } = require('./index');

class ScraperServer {
  constructor(config = {}) {
    this.port = config.port || 3000;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.activeJobs = new Map();
    this.jobHistory = [];
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API: Start scraping job
    this.app.post('/api/scrape', async (req, res) => {
      const config = req.body;
      const jobId = this.generateJobId();
      
      try {
        // Validate config
        if (!config.baseUrl) {
          return res.status(400).json({ error: 'baseUrl is required' });
        }

        // Create job
        const job = {
          id: jobId,
          config,
          status: 'running',
          startedAt: new Date().toISOString(),
          progress: {
            current: 0,
            total: 0,
            currentUrl: ''
          }
        };

        this.activeJobs.set(jobId, job);
        
        // Start scraping in background
        this.runScrapingJob(jobId, config);

        res.json({ jobId, status: 'started' });

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API: Get job status
    this.app.get('/api/jobs/:jobId', (req, res) => {
      const { jobId } = req.params;
      const job = this.activeJobs.get(jobId);
      
      if (!job) {
        const historyJob = this.jobHistory.find(j => j.id === jobId);
        if (historyJob) {
          return res.json(historyJob);
        }
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    });

    // API: List all jobs
    this.app.get('/api/jobs', (req, res) => {
      const active = Array.from(this.activeJobs.values());
      const history = this.jobHistory.slice(-20); // Last 20 jobs
      
      res.json({
        active,
        history
      });
    });

    // API: Cancel job
    this.app.post('/api/jobs/:jobId/cancel', (req, res) => {
      const { jobId } = req.params;
      const job = this.activeJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      job.status = 'cancelled';
      job.cancelledAt = new Date().toISOString();
      
      this.moveToHistory(jobId);
      
      res.json({ status: 'cancelled' });
    });

    // API: Download results
    this.app.get('/api/jobs/:jobId/download/:format', (req, res) => {
      const { jobId, format } = req.params;
      const job = this.activeJobs.get(jobId) || this.jobHistory.find(j => j.id === jobId);
      
      if (!job || !job.result) {
        return res.status(404).json({ error: 'Results not found' });
      }

      const outputDir = job.config.outputDir || './output';
      let filePath;

      switch (format) {
        case 'json':
          filePath = path.join(outputDir, 'data.json');
          break;
        case 'sitemap':
          filePath = path.join(outputDir, 'sitemap.xml');
          break;
        default:
          return res.status(400).json({ error: 'Invalid format' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.download(filePath);
    });
  }

  /**
   * Setup WebSocket for live updates
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      // Send initial state
      this.sendToClient(ws, {
        type: 'init',
        data: {
          activeJobs: Array.from(this.activeJobs.values()),
          history: this.jobHistory.slice(-10)
        }
      });
    });
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        ws.jobId = data.jobId;
        break;
      case 'unsubscribe':
        ws.jobId = null;
        break;
    }
  }

  /**
   * Broadcast to all WebSocket clients
   */
  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast job update
   */
  broadcastJobUpdate(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      this.broadcast({
        type: 'job_update',
        data: job
      });
    }
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Run scraping job
   */
  async runScrapingJob(jobId, config) {
    const job = this.activeJobs.get(jobId);
    
    try {
      const result = await scrapeAndExport({
        ...config,
        outputDir: config.outputDir || `./output/${jobId}`,
        onProgress: (progress) => {
          job.progress = {
            current: progress.progress || 0,
            total: progress.total || 0,
            currentUrl: progress.url || '',
            status: progress.status || 'scraping'
          };
          this.broadcastJobUpdate(jobId);
        }
      });

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        totalPages: result.statistics.totalPages,
        totalWords: result.statistics.totalWords,
        exports: Object.keys(result.exports)
      };

      this.broadcastJobUpdate(jobId);
      this.moveToHistory(jobId);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date().toISOString();
      
      this.broadcastJobUpdate(jobId);
      this.moveToHistory(jobId);
    }
  }

  /**
   * Move job to history
   */
  moveToHistory(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      this.jobHistory.push(job);
      this.activeJobs.delete(jobId);
      
      // Keep only last 100 jobs in history
      if (this.jobHistory.length > 100) {
        this.jobHistory = this.jobHistory.slice(-100);
      }
    }
  }

  /**
   * Start server
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`\n🚀 Content Scraper Server running on http://localhost:${this.port}`);
      console.log(`📊 WebSocket endpoint: ws://localhost:${this.port}`);
      console.log(`\n✨ Open http://localhost:${this.port} in your browser\n`);
    });
  }

  /**
   * Stop server
   */
  stop() {
    this.wss.close();
    this.server.close();
  }
}

// Run server if executed directly
if (require.main === module) {
  const server = new ScraperServer({ port: process.env.PORT || 3000 });
  server.start();
}

module.exports = { ScraperServer };
