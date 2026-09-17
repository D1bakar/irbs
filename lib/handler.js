// Shared serverless entry (Vercel/Netlify): every api/*.js re-exports this so a
// throw can never surface as a bare FUNCTION_INVOCATION_FAILED (always JSON).
// Top-level require stays (bundlers trace it); load errors are caught and
// reported as JSON with the message so /api/health diagnoses itself.
let handleApi = null, loadErr = null;
try {
  handleApi = require("../serve").handleApi;
} catch (e) { loadErr = e; }
module.exports = async (req, res) => {
  const fail = (msg) => {
    try {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "internal", msg: String((msg && msg.message) || msg || "").slice(0, 200) }));
    } catch (_) {}
  };
  if (!handleApi) return fail(loadErr && loadErr.message ? "load: " + loadErr.message : "load");
  try {
    await handleApi(req, res);
  } catch (e) {
    fail(e);
  }
};
