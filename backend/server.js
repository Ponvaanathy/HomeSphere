const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend/.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}


const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const searchRoutes = require('./routes/searchRoutes');
const compareRoutes = require('./routes/compareRoutes');
const savedRoutes = require('./routes/savedRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const rentalApplicationRoutes = require('./routes/rentalApplicationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets Serving
const frontendDir = path.join(__dirname, '../frontend');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/images', express.static(path.join(frontendDir, 'images')));
app.use('/documents', express.static(path.join(__dirname, '../documents')));
app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use('/admin', express.static(path.join(frontendDir, 'admin')));

// Serve root static frontend pages
app.use(express.static(frontendDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    app: 'HomeSphere AI Decision Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/rental-applications', rentalApplicationRoutes);
app.use('/api/messages', messageRoutes);

// API 404 for unmatched /api routes
app.use('/api/*', notFoundHandler);

// Clean page routing (supports both /profile and /profile.html)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const cleanPath = req.path.replace(/\/$/, '');
  const directPath = path.join(frontendDir, cleanPath);
  const htmlPath = path.join(frontendDir, cleanPath + '.html');

  if (cleanPath && fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
    return res.sendFile(htmlPath);
  }
  if (cleanPath && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return res.sendFile(directPath);
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});


// Centralized Error Handler
app.use(errorHandler);

const pool = require('./config/db');
const { startExpiryJob } = require('./services/expiryService');

// Export Express app for Vercel Serverless Functions
module.exports = app;

// Start HTTP Server when executed directly (node server.js or npm run dev)
if (require.main === module) {
  (async () => {
    try {
      const dbStatus = await pool.testDatabaseConnection();

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        if (dbStatus.connected) {
          console.log(`✅ MySQL Database Connected Successfully`);
          console.log(`Database: ${dbStatus.database}`);
          console.log(`Host: ${dbStatus.host}`);
          console.log(`Port: ${dbStatus.port}`);
        } else {
          console.error(`❌ MySQL Database Connection Failed`);
          console.error(`Error: ${dbStatus.error}`);
        }

        // Start background auto-expiry job
        startExpiryJob();
      });
    } catch (err) {
      console.error(`❌ MySQL Database Connection Failed`);
      console.error(`Error: ${err.message || err}`);
    }
  })();
}


