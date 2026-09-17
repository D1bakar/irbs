// Shared serverless entry (Vercel/Netlify): every api/*.js re-exports this so a
// throw can never surface as a bare FUNCTION_INVOCATION_FAILED (always JSON).
const { handleApi } = require("../serve");
module.exports = async (req, res) => {
  try {
    await handleApi(req, res);
  } catch (e) {
    try {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "internal" }));
    } catch (_) {}
  }
};
