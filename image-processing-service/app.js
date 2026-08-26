// EXPRESS APP

const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const imageRoutes = require('./routes/imageRoutes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

const app = express();

// ---- GLOBAL MIDDLEWARE ----

app.use(cors());

// express.json() parses incoming requests with a JSON body 
app.use(express.json());

// ---- FRONTEND (STATIC FILES) ----
// Serves everything in /public directly — index.html, style.css,
// app.js. Because this is the SAME app (and therefore the SAME
// origin) 
app.use(express.static(path.join(__dirname, 'public')));

// ---- ROUTES ----

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

// A simple health-check endpoint — useful for confirming the server
// is up, and for load balancers / uptime monitors in a real deploy.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- 404 HANDLER ----
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server.`, 404));
});

// ---- CENTRAL ERROR HANDLER ----

app.use(errorHandler);

module.exports = app;
