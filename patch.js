const fs = require('fs');

// ─── PATCH writer.ts ────────────────────────────────────────────
let writer = fs.readFileSync('worker/src/bridge/writer.ts', 'utf8');

// 1. Replace writeArticles with wave-based processing
const oldWriteArticles = /export const writeArticles = async \([\s\S]*?^\};$/m;
const newWriteArticles = `export const writeArticles = async (
  items: RawFeedItem[],
  env: WorkerEnv,
  trackedCategories: string[] = DEFAULT_CATEGORY_POOL
): Promise<NewsletterArticle[]> => {
  const MIN_ARTICLES = 4;
  const WAVE_SIZE = 6;
  const HARD_CAP = 30;
  const results: NewsletterArticle[] = [];
  const concurrency = 2;
  const categoryPool = [...new Set([...trackedCategories, ...DEFAULT_CATEGORY_POOL])].slice(0, 10);

  console.log(
    \`LLM rewrite: need \${MIN_ARTICLES} quality articles, up to \${HARD_CAP} sources available\`
  );

  for (let waveStart = 0; waveStart < Math.min(items.length, HARD_CAP); waveStart += WAVE_SIZE) {
    const wave = items.slice(waveStart, waveStart + WAVE_SIZE);
    const waveNum = Math.floor(waveStart / WAVE_SIZE) + 1;
    const totalWaves = Math.ceil(Math.min(items.length, HARD_CAP) / WAVE_SIZE);
    const pendingLabels = new Set(wave.map((item) => item.title.substring(0, 36)));

    console.log(\`Wave \${waveNum}/\${totalWaves}: processing \${wave.length} items (have \${results.length})\`);

    const wrapped = wave.map((item) => {
      const label = item.title.substring(0, 36);
      return rewriteItem(item, env, categoryPool).finally(() => pendingLabels.delete(label));
    });

    const heartbeatId = setInterval(() => {
      if (!pendingLabels.size) return;
      const sample = [...pendingLabels].slice(0, 2).join(' | ');
      console.log(\`In-flight wave \${waveNum}: pending \${pendingLabels.size} (\${sample}...)\`);
    }, LLM_CHUNK_HEARTBEAT_MS);

    const settled = await Promise.allSettled(wrapped);
    clearInterval(heartbeatId);

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    console.log(\`Wave \${waveNum} done: \${results.length} articles gathered\`);

    if (results.length >= MIN_ARTICLES) {
      console.log(\`Reached \${MIN_ARTICLES} articles. Stopping.\`);
      break;
    }
  }

  if (results.length < MIN_ARTICLES) {
    console.warn(\`WARNING: Only \${results.length}/\${MIN_ARTICLES} articles gathered.\`);
  }

  return results;
};`;

writer = writer.replace(oldWriteArticles, newWriteArticles);

// 2. Update buildShortCardContent to return null if content is too generic
const oldShortCard = /const buildShortCardContent = \([\s\S]*?^\};$/m;
const newShortCard = `const buildShortCardContent = (content: string, item: RawFeedItem): string | null => {
  const keyPoints = extractMarkdownSection(content, [
    /##\\s*Key\\s*Takeaways?\\s*\\n([\\s\\S]*?)(?=\\n##|$)/i
  ]);
  const whatHappened = extractMarkdownSection(content, [
    /##\\s*What\\s*Happened\\s*\\n([\\s\\S]*?)(?=\\n##|$)/i
  ]);

  // Extract meaningful content from source if LLM sections are empty
  const sourceText = [item.summary, item.sourceSnippet || ''].join(' ').trim();
  const sentences = splitSentences(sourceText);
  const sourceFacts = sentences.filter(s => s.length > 30 && !s.includes('should be validated')).slice(0, 3);

  const cleanKt = keyPoints || (sourceFacts.length > 0 ? sourceFacts.map(f => '- ' + f).join('\\n') : '');
  const cleanWh = whatHappened || (sourceFacts.length > 0 ? sourceFacts[0] : '');

  // If we have NO meaningful content at all, return null to drop this article
  if (!cleanKt && !cleanWh) {
    console.warn(\`Dropping article with zero extractable content: \${item.title}\`);
    return null;
  }

  const bullets = cleanKt.split('\\n').filter((line) => line.trim().startsWith('-')).slice(0, 3);
  const ktBlock = bullets.length > 0 ? bullets.join('\\n') : (cleanKt ? '- ' + cleanKt : '- Source reported a security update.');
  const whBlock = cleanWh || 'Source details are limited.';

  return \`**Severity:** Medium\\n**Affected Sectors:** General\\n**Threat Type:** \${item.category.replace(/-/g, ' ')}\\n**Attribution:** Unknown\\n\\n## Key Takeaways\\n\${ktBlock}\\n\\n## What Happened\\n\${clampSnippet(whBlock, 280)}\`;
};`;

writer = writer.replace(oldShortCard, newShortCard);

// 3. Update applyTieredQualityGate to drop null short cards
const oldGate = /const applyTieredQualityGate = \([\s\S]*?^\};$/m;
const newGate = `const applyTieredQualityGate = (
  article: NewsletterArticle,
  item: RawFeedItem
): NewsletterArticle | null => {
  const tier = (article as any).tier || 'full';

  // Tier 2: Drop entirely
  if (tier === 'drop' || article.sufficient_data === false) {
    console.warn(\`TIER 2 DROP: \${article.title}\`);
    return null;
  }

  // Tier 1: Shortened card
  if (tier === 'short') {
    const shortContent = buildShortCardContent(article.content, item);
    if (!shortContent) return null;
    return {
      ...article,
      content: shortContent,
      summary: article.summary || 'Brief security update.'
    };
  }

  // Full article: validate depth and check for template text
  const content = article.content || '';
  const hasKeyTakeaways = /##\\s*Key\\s*Takeaways?/i.test(content);
  const hasWhatHappened = /##\\s*What\\s*Happened/i.test(content);
  const hasWhyItMatters = /##\\s*Why\\s*It\\s*Matters?/i.test(content);

  const keyTakeawaysSection = extractMarkdownSection(content, [
    /##\\s*Key\\s*Takeaways?\\s*\\n([\\s\\S]*?)(?=\\n##|$)/i
  ]);
  const whatHappenedSection = extractMarkdownSection(content, [
    /##\\s*What\\s*Happened\\s*\\n([\\s\\S]*?)(?=\\n##|$)/i
  ]);
  const whyItMattersSection = extractMarkdownSection(content, [
    /##\\s*Why\\s*It\\s*Matters?\\s*\\n([\\s\\S]*?)(?=\\n##|$)/i
  ]);

  const ktBullets = keyTakeawaysSection.split('\\n').filter((line) => line.trim().startsWith('-')).length;
  const whWords = countWords(whatHappenedSection);
  const hasTemplateText = isTemplateText(whyItMattersSection);

  if (!hasKeyTakeaways || !hasWhatHappened || !hasWhyItMatters || ktBullets < 2 || whWords < 15 || hasTemplateText) {
    const reason = hasTemplateText ? 'template text' : 'insufficient depth';
    console.warn(\`TIER 1 SHORT: \${article.title} (\${reason}, bullets=\${ktBullets}, words=\${whWords})\`);
    const shortContent = buildShortCardContent(content, item);
    if (!shortContent) return null;
    return {
      ...article,
      content: shortContent,
      summary: article.summary || 'Brief security update.'
    };
  }

  return article;
};`;

writer = writer.replace(oldGate, newGate);

fs.writeFileSync('worker/src/bridge/writer.ts', writer);
console.log('writer.ts patched');

// ─── PATCH digest.ts ────────────────────────────────────────────
let digest = fs.readFileSync('worker/src/email/digest.ts', 'utf8');

// 1. Simplify greeting
digest = digest.replace(
  'briefing: clear threat context, key developments, and quick actions worth prioritizing today.',
  ''
);

// 2. Remove category label and metadata badges from article cards
const oldArticleBlock = `<div style="font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${ACCENT};margin-bottom:10px;font-family:Arial,sans-serif;">${category}</div>
          ${metadataBlock}
          <a href="${originalHref}" style="font-size:24px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};text-decoration:none;display:block;font-family:Arial,sans-serif;">${title}</a>`;
const newArticleBlock = `<a href="${originalHref}" style="font-size:24px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};text-decoration:none;display:block;font-family:Arial,sans-serif;">${title}</a>`;
digest = digest.replace(oldArticleBlock, newArticleBlock);

// 3. Update author section to use 7secure logo
const oldAuthorSection = `const buildAuthorSection = (authors: Array<{ name: string; image_url?: string | null }>): string => {
  const authorItems = authors.map((author) => {
    const img = author.image_url
      ? \`<img src="${author.image_url}" alt="${escapeHtml(author.name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};" />\`
      : \`<div style="width:40px;height:40px;border-radius:50%;background:${ACCENT};display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:16px;font-weight:700;">${author.name.charAt(0).toUpperCase()}</div>\`;
    return \`<td style="padding:0 12px 0 0;text-align:center;">${img}<p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${escapeHtml(author.name)}</p></td>\`;
  }).join("");`;

const newAuthorSection = `const buildAuthorSection = (siteBase: string, authors: Array<{ name: string; image_url?: string | null }>): string => {
  const authorItems = authors.map((author) => {
    const img = author.image_url
      ? \`<img src="${author.image_url}" alt="${escapeHtml(author.name)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};" />\`
      : \`<img src="${siteBase}/7secure_logo.svg" alt="7secure" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};background:#ffffff;padding:4px;" />\`;
    return \`<td style="padding:0 12px 0 0;text-align:center;">${img}<p style="margin:6px 0 0 0;font-size:13px;color:${TEXT_SECONDARY};font-family:Arial,sans-serif;">${escapeHtml(author.name)}</p></td>\`;
  }).join("");`;

digest = digest.replace(oldAuthorSection, newAuthorSection);

// Update buildAuthorSection call to pass siteBase
digest = digest.replace(
  'const authorSection = authors.length > 0 ? buildAuthorSection(authors) : "";',
  'const authorSection = authors.length > 0 ? buildAuthorSection(siteBase, authors) : "";'
);

fs.writeFileSync('worker/src/email/digest.ts', digest);
console.log('digest.ts patched');

// ─── PATCH fetcher.ts ───────────────────────────────────────────
let fetcher = fs.readFileSync('worker/src/rss/fetcher.ts', 'utf8');
fetcher = fetcher.replace(
  'const DEFAULT_BRAVE_RESULTS_PER_QUERY = 12;',
  'const DEFAULT_BRAVE_RESULTS_PER_QUERY = 16;'
);
fs.writeFileSync('worker/src/rss/fetcher.ts', fetcher);
console.log('fetcher.ts patched');
