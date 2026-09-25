// Tiny converter: README.md → styled HTML for headless-Chrome PDF.
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const md = readFileSync('/home/stefanos/Downloads/goated-relational-n-back-main/README.md', 'utf8');
const body = marked.parse(md, { gfm: true, breaks: false });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>GOATED Relational n-Back — Reference</title>
<style>
  @page { margin: 16mm 14mm 16mm 14mm; }
  body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #0d1117; max-width: 740px; margin: 0 auto; }
  h1 { font-size: 22pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6pt; margin-top: 24pt; margin-bottom: 14pt; }
  h2 { font-size: 16pt; color: #4f46e5; margin-top: 22pt; margin-bottom: 10pt; padding-top: 6pt; border-top: 1px solid #e2e8f0; }
  h3 { font-size: 12.5pt; color: #1e293b; margin-top: 16pt; margin-bottom: 8pt; }
  p, ul, ol { margin: 6pt 0; }
  ul, ol { padding-left: 22pt; }
  li { margin: 3pt 0; }
  code { font-family: "SFMono-Regular", Consolas, Menlo, monospace; font-size: 9pt; background: #f1f5f9; padding: 1.5pt 4pt; border-radius: 3pt; color: #be185d; }
  pre { background: #0f172a; color: #e2e8f0; padding: 10pt 14pt; border-radius: 6pt; font-size: 9pt; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 5pt 8pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  a { color: #4f46e5; text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 18pt 0; }
  blockquote { border-left: 3pt solid #4f46e5; padding-left: 10pt; margin: 8pt 0; color: #475569; font-style: italic; }
  strong { color: #1e293b; }
  em { color: #475569; }
  h1:first-child { margin-top: 0; border-top: none; padding-top: 0; }
  h2:first-of-type { border-top: none; padding-top: 0; }
</style>
</head>
<body>
${body}
<hr/>
<p style="text-align:center; color:#64748b; font-size:9pt;">
Generated from <a href="https://github.com/find-1-bug/goated-relational-nback-2/blob/main/README.md">README.md</a> · ${new Date().toISOString().slice(0,10)}
</p>
</body>
</html>`;

writeFileSync('/tmp/gnb-report.html', html, 'utf8');
console.log('wrote /tmp/gnb-report.html');
