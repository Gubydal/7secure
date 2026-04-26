const fs = require('fs');

// 1. Update wrangler.toml
let toml = fs.readFileSync('worker/wrangler.toml', 'utf8');
toml = toml.replace('LLM_BASE_URL = "https://api.longcat.chat/openai/v1"', 'LLM_BASE_URL = "https://openrouter.ai/api/v1"');
toml = toml.replace('LLM_MODEL = "kimi-k2-thinking:cloud"', 'LLM_MODEL = "openai/gpt-oss-120b:free"');
toml = toml.replace(/# NOTE: Set LLM_BASE_URL[\s\S]*?#   - Self-hosted:.*/, '# OpenRouter configuration — API key set in Cloudflare Dashboard');
fs.writeFileSync('worker/wrangler.toml', toml);
console.log('Updated wrangler.toml');

// 2. Update writer.ts — add OpenRouter headers to LLM fetch calls
let writer = fs.readFileSync('worker/src/bridge/writer.ts', 'utf8');
// Replace the Authorization header block in rewriteItem
writer = writer.replace(
  /headers: \{\s*"Content-Type": "application\/json",\s*Authorization: `Bearer \$\{env\.LLM_API_KEY\}`\s*\}/g,
  `headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${env.LLM_API_KEY}\`,
          "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev",
          "X-Title": "7secure"
        }`
);
// Replace the Authorization header block in generateThreatPulse
writer = writer.replace(
  /headers: \{\s*"Content-Type": "application\/json",\s*Authorization: `Bearer \$\{env\.LLM_API_KEY\}`\s*\}/g,
  `headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${env.LLM_API_KEY}\`,
        "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev",
        "X-Title": "7secure"
      }`
);
fs.writeFileSync('worker/src/bridge/writer.ts', writer);
console.log('Updated writer.ts');

// 3. Update title-generator.ts
let titleGen = fs.readFileSync('worker/src/bridge/title-generator.ts', 'utf8');
titleGen = titleGen.replace(
  /headers: \{\s*"Content-Type": "application\/json",\s*Authorization: `Bearer \$\{env\.LLM_API_KEY\}`\s*\}/g,
  `headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${env.LLM_API_KEY}\`,
          "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev",
          "X-Title": "7secure"
        }`
);
fs.writeFileSync('worker/src/bridge/title-generator.ts', titleGen);
console.log('Updated title-generator.ts');

// 4. Update snippet-generator.ts
let snippetGen = fs.readFileSync('worker/src/bridge/snippet-generator.ts', 'utf8');
snippetGen = snippetGen.replace(
  /headers: \{\s*"Content-Type": "application\/json",\s*Authorization: `Bearer \$\{env\.LLM_API_KEY\}`\s*\}/g,
  `headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${env.LLM_API_KEY}\`,
          "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL || "https://7secure.pages.dev",
          "X-Title": "7secure"
        }`
);
fs.writeFileSync('worker/src/bridge/snippet-generator.ts', snippetGen);
console.log('Updated snippet-generator.ts');

// 5. Update .dev.vars
let devVars = fs.readFileSync('worker/.dev.vars', 'utf8');
// Remove old Ollama placeholders if present
devVars = devVars.replace(/# Ollama LLM config[\s\S]*?LLM_API_KEY=.*/g, '');
devVars = devVars.replace(/\n\n+/g, '\n');
devVars += '\n# OpenRouter config\nLLM_BASE_URL=https://openrouter.ai/api/v1\nLLM_API_KEY=e3752799b1b3440799f926a1bdbe4cb6.Dr5SvRLKPPYmI9eqAV2tJ-St\n';
fs.writeFileSync('worker/.dev.vars', devVars);
console.log('Updated .dev.vars');

console.log('\nDone! Now commit and deploy with: git add -A && git commit -m "config: switch to OpenRouter openai/gpt-oss-120b:free" && git push && npx wrangler deploy --config worker/wrangler.toml');
