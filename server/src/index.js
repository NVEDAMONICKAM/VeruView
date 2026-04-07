// Local development entry point — imports the app and starts the HTTP server.
// For Vercel deployment, use api/index.js instead.
const app  = require('./app');
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`VeruView server running on http://localhost:${PORT}`);
});
