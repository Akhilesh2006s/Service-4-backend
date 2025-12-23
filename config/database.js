// Database configuration
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(mongoURI, {
      // These options are recommended for Mongoose 6+
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };

