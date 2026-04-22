// Connectivity probe for the local LLM server.
// To target a different host/port, edit CONFIG below (single source of truth for this script).
// Production TS code uses lib/providers/local-config.ts instead (REQ-LOCAL-080).

const CONFIG = {
  port: 8080,
  path: "/v1/models",
  hosts: ["localhost", "127.0.0.1", "host.docker.internal"],
};

async function checkConnectivity() {
  const urls = CONFIG.hosts.map((h) => `http://${h}:${CONFIG.port}${CONFIG.path}`);

  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      console.log(`  ✓ Connected, status:`, response.status);
    } catch (error) {
      console.log(`  ✗ Failed:`, error.message);
    }
  }
}

checkConnectivity();
