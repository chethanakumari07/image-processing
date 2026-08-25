
// SERVER ENTRY POINT

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const imageRoutes = require('./routes/imageRoutes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

const app = express();

//  GLOBAL MIDDLEWARE 

app.use(cors());
app.use(express.json());

//  FRONTEND (STATIC FILES) 
app.use(express.static(path.join(__dirname, 'public')));

//  ROUTES 
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 HANDLER 
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, 404));
});

//  CENTRAL ERROR HANDLER 
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Image processing service running on http://localhost:${PORT}`);
});
