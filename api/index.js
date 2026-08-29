/**
 * HomeSphere - Vercel Serverless Function Handler
 * Bridges incoming requests directly to the Express application.
 */

const app = require('../backend/server');

module.exports = app;
