const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  try {
    mongoose.set('bufferCommands', false);
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/colortrading';
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 2000 // Fast timeout for dev fallback
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.log('Using in-memory mock database for development');
    return false;
  }
};

module.exports = connectDB;
