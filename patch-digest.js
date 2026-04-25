const fs = require('fs');
let digest = fs.readFileSync('worker/src/email/digest.ts', 'utf8');

// 1. Simplify greeting — remove the extra text after date
digest = digest.replace(
  ' briefing: clear threat context, key developments, and quick actions worth prioritizing today.',
  ''
);

// 2. Remove category label div and metadataBlock from article cards
// The pattern is: category div + newline/spaces + metadataBlock variable + newline/spaces + title link
// We want to keep only the title link
digest = digest.replace(
  /<div style="font-size:12px;font-weight:700;letter-spacing:0\.15em;text-transform:uppercase;color:\$\{ACCENT\};margin-bottom:10px;font-family:Arial,sans-serif;">\$\{category\}<\/div>\s+\$\{metadataBlock\}\s+<a href="\$\{originalHref\}" style="font-size:24px;line-height:1\.2;font-weight:800;color:\$\{TEXT_PRIMARY\};text-decoration:none;display:block;font-family:Arial,sans-serif;">\$\{title\}<\/a>/g,
  '<a href="${originalHref}" style="font-size:24px;line-height:1.2;font-weight:800;color:${TEXT_PRIMARY};text-decoration:none;display:block;font-family:Arial,sans-serif;">${title}</a>'
);

// 3. Update author section to use 7secure logo instead of initials div
digest = digest.replace(
  /const buildAuthorSection = \(authors: Array<\{ name: string; image_url\?: string \| null \}>\): string => \{/g,
  'const buildAuthorSection = (siteBase: string, authors: Array<{ name: string; image_url?: string | null }>): string => {'
);

// Replace the initials fallback div with the 7secure logo image
digest = digest.replace(
  /<div style="width:40px;height:40px;border-radius:50%;background:\$\{ACCENT\};display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:16px;font-weight:700;">\$\{author\.name\.charAt\(0\)\.toUpperCase\(\)\}<\/div>/g,
  '<img src="${siteBase}/7secure_logo.svg" alt="7secure" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${BORDER_COLOR};background:#ffffff;padding:4px;" />'
);

// Update the buildAuthorSection call to pass siteBase
digest = digest.replace(
  'const authorSection = authors.length > 0 ? buildAuthorSection(authors) : "";',
  'const authorSection = authors.length > 0 ? buildAuthorSection(siteBase, authors) : "";'
);

fs.writeFileSync('worker/src/email/digest.ts', digest);
console.log('digest.ts patched');
