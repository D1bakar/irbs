// Vercel/Netlify entry - delegates to the shared router in serve.js.
// Shared try/catch lives in ../lib/handler.js so failures stay JSON, never blank 500s.
module.exports = require("../lib/handler");
