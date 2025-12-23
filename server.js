const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy so secure cookies work on Railway/Heroku-like platforms
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// CORS configuration
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'gst-billing-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    // Required to allow cross-site cookies when frontend and backend are on different domains
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'GST Billing API is running!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/import-export', require('./routes/importExport'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

