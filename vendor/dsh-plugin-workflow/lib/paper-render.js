import { marked } from 'marked';
import katex from 'katex';

const TOKEN = 'PAPERMATHTOKEN';

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderMath(tex, displayMode) {
  const math = katex.renderToString(tex.trim(), { displayMode, output: 'mathml', throwOnError: true, trust: false, strict: 'warn' });
  return displayMode
    ? `<div class="paper-equation" role="group" aria-label="公式：${escape(tex.trim())}">${math}</div>`
    : `<span class="paper-inline-math">${math}</span>`;
}

export function renderPaperMarkdown(markdown) {
  if (typeof markdown !== 'string' || markdown.length < 100 || /<\s*\/?[a-z][^>]*>/i.test(markdown)) throw new Error('PAPER_MARKDOWN_INVALID');
  const formulas = [];
  const substitute = (tex, display) => {
    const id = `${TOKEN}${formulas.length}END`;
    formulas.push(renderMath(tex, display));
    return id;
  };
  let source = markdown.replace(/(^|\n)\$\$\s*([\s\S]*?)\s*\$\$(?=\n|$)/g, (_, lead, tex) => lead + '\n' + substitute(tex, true) + '\n');
  source = source.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, tex) => substitute(tex, false));
  let html = marked.parse(source, { gfm: true, breaks: false });
  if (typeof html !== 'string') throw new Error('PAPER_MARKDOWN_INVALID');
  formulas.forEach((formula, i) => { html = html.replace(`<p>${TOKEN}${i}END</p>`, formula).replaceAll(`${TOKEN}${i}END`, formula); });
  html = html.replace(/<blockquote>\s*<p><strong>Q[：:]<\/strong>\s*([\s\S]*?)<\/p>\s*<p><strong>A[：:]<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/g,
    (_, question, answer) => `<aside class="paper-qa" aria-label="问答"><p class="paper-qa-question"><strong>Q：</strong>${question}</p><p class="paper-qa-answer"><strong>A：</strong>${answer}</p></aside>`);
  html = html.replace(/^<h1>.*?<\/h1>\n?/s, '');
  let heading = 0;
  html = html.replace(/<h([2-6])>/g, (_, level) => `<h${level} id="section-${++heading}">`);
  html = html.replace(/(<h2 id="section-\d+">论文信息<\/h2>)\s*(<ul>[\s\S]*?<\/ul>)/,
    '<section class="paper-source" aria-label="论文信息"><span class="eyebrow">PAPER / 原文信息</span>$1$2</section>');
  html = html.replace(/(<h2 id="section-\d+">快速阅读<\/h2>)\s*<ul>/,
    '$1<ul class="quick-read">');
  html = html.replace(/<p><img src="(\/lab\/assets\/paper-overviews\/[a-z0-9-]+\.svg)" alt="([^"]*)"><\/p>\s*<p><em>([^<]*)<\/em><\/p>/,
    '<figure class="paper-overview"><img src="$1" alt="$2"><figcaption>$3</figcaption></figure>');
  html = html.replace(/<table>[\s\S]*?<\/table>/g, table => `<div class="table-scroll">${table}</div>`);
  html = html.replace(/<p>([^<>]{181,})<\/p>/g, (_, prose) => {
    const sentences = prose.match(/[^。！？]*[。！？]?/g)?.filter(Boolean) ?? [prose];
    const paragraphs = [];
    let current = '';
    for (const sentence of sentences) {
      if (current && [...current, ...sentence].length > 140) { paragraphs.push(current.trim()); current = ''; }
      current += sentence;
    }
    if (current.trim()) paragraphs.push(current.trim());
    return paragraphs.map(part => `<p>${part}</p>`).join('\n');
  });
  return { html, headings: heading, formulas: formulas.length };
}

export function insertPaperOverview(markdown, imagePath) {
  if (!imagePath || !/^\/lab\/assets\/paper-overviews\/[a-z0-9-]+\.svg$/.test(imagePath)) throw new Error('PAPER_OVERVIEW_PATH_INVALID');
  const insertion = `\n![论文逻辑总览图](${imagePath})\n\n*论文逻辑总览：问题、方法、证据与适用边界。*\n`;
  const start = markdown.search(/^## 快速阅读\s*$/m);
  if (start < 0) throw new Error('PAPER_QUICK_READ_REQUIRED');
  const next = markdown.slice(start + 3).search(/^## /m);
  const offset = next < 0 ? markdown.length : start + 3 + next;
  return markdown.slice(0, offset).trimEnd() + '\n' + insertion + '\n' + markdown.slice(offset).trimStart();
}

export function renderWechatPage({ title, html, overviewSvg }) {
  const svgData = overviewSvg ? `data:image/svg+xml;base64,${Buffer.from(overviewSvg).toString('base64')}` : '';
  const article = overviewSvg ? html.replace(/src="\/lab\/assets\/paper-overviews\/[a-z0-9-]+\.svg"/, `src="${svgData}"`) : html;
  const safeTitle = escape(title);
  const componentCss = `.sheet .paper-source{padding:20px;margin:22px 0 30px;background:#f2f8f6;border:1px solid #d4e5e0;border-radius:9px}.sheet .paper-source h2{font-size:19px;line-height:1.45;margin:7px 0 15px;padding:0;border:0;color:#203943}.sheet .paper-source .eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;color:#235b67}.sheet .paper-source dl{margin:0}.sheet .paper-source dl>div{margin:10px 0}.sheet .paper-source dt{font-size:12px;font-weight:700;color:#667d7e}.sheet .paper-source dd{font-size:13px;line-height:1.65;margin:3px 0 0}.sheet .paper-source ul{margin:0;padding-left:19px}.sheet .paper-source li{font-size:13px;line-height:1.65;margin:8px 0}.sheet .quick-read{padding:16px 24px;background:#f4f9f7;border:1px solid #d9e8e4;border-radius:9px}.sheet .quick-read li{padding:7px 0}.sheet .quick-read strong{display:inline-block;color:#235b67;margin-right:10px}.sheet .paper-overview{margin:26px 0;padding:12px;background:#faf6ed;text-align:center}.sheet .paper-overview img{max-width:100%;margin:0 auto}.sheet .paper-overview figcaption{font-size:12px;color:#607078}.sheet .paper-qa{border-left:0;border:1px solid #d5e6e2;border-radius:8px}.sheet .paper-qa__row{display:flex;gap:10px;align-items:flex-start;margin:5px 0}.sheet .paper-qa__tag{font-weight:700;color:#235b67;white-space:nowrap}.sheet .paper-qa__tag--answer{color:#ad663f}.sheet .paper-qa__row p{margin:0}.sheet .table-scroll{max-width:100%;overflow:auto}.sheet em{color:#637175}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} · 公众号排版</title>
<style>body{margin:0;background:#f3f5f4;color:#25343b;font-family:"PingFang SC","Noto Sans SC",system-ui,sans-serif}.toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px max(20px,calc((100vw - 740px)/2));background:#fff;border-bottom:1px solid #dce5e3}.toolbar strong{font-size:14px}.toolbar button{cursor:pointer;border:0;border-radius:8px;background:#235b67;color:#fff;padding:10px 18px;font-size:14px}.toolbar button:focus-visible{outline:3px solid #c18253;outline-offset:2px}.sheet{max-width:740px;margin:24px auto;background:#fff;padding:42px 52px 70px;box-shadow:0 8px 30px #25343b0d}.sheet h1{font-size:30px;line-height:1.45;letter-spacing:-.01em;margin:0 0 25px;color:#203943}.sheet h2{font-size:23px;line-height:1.5;margin:46px 0 18px;color:#234b58;border-left:4px solid #b67850;padding-left:12px}.sheet h3{font-size:19px}.sheet p,.sheet li{font-size:16px;line-height:1.9;letter-spacing:.01em}.sheet p{margin:0 0 20px}.sheet li{margin:8px 0}.sheet a{color:#235b67;text-decoration:underline}.sheet img{display:block;max-width:100%;height:auto;margin:24px auto}.sheet table{border-collapse:collapse;width:100%;font-size:13px}.sheet th,.sheet td{padding:8px;border:1px solid #dce5e3}.sheet th{background:#eaf3f3}.sheet blockquote,.sheet .paper-qa{margin:20px 0;padding:14px 20px;background:#eff7f5;border-left:4px solid #235b67}.sheet .paper-qa p{margin:0 0 8px}.sheet .paper-qa p:last-child{margin:0}.sheet .paper-qa-answer{color:#3d545b}.sheet .paper-equation{overflow:auto;padding:16px 20px;margin:18px 0;background:#f6f8f7;border:1px solid #dce5e3;border-radius:8px;text-align:center}.sheet math{font-size:1.25em}.sheet .paper-inline-math math{font-size:1em}@media(max-width:680px){.sheet{margin:0;padding:28px 20px 45px}.toolbar{padding:12px 16px}.sheet h1{font-size:25px}}${componentCss}</style></head><body>
<div class="toolbar"><strong>公众号排版 · 本地预览</strong><button type="button" id="copy">复制公众号排版</button></div>
<main class="sheet" id="copy-content"><h1>${safeTitle}</h1>${article}</main>
<script>document.getElementById('copy').addEventListener('click',async()=>{const root=document.getElementById('copy-content');const clone=root.cloneNode(true);const properties=['color','background-color','font-family','font-size','font-weight','line-height','letter-spacing','text-align','margin','padding','border','border-left','border-radius','display','max-width','width','height'];const visit=(source,target)=>{const style=getComputedStyle(source);for(const key of properties)target.style.setProperty(key,style.getPropertyValue(key));for(let i=0;i<source.children.length;i++)visit(source.children[i],target.children[i])};visit(root,clone);const markup=clone.outerHTML;try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([markup],{type:'text/html'}),'text/plain':new Blob([root.innerText],{type:'text/plain'})})]);document.getElementById('copy').textContent='已复制排版'}catch{const selection=getSelection();const range=document.createRange();range.selectNodeContents(root);selection.removeAllRanges();selection.addRange(range);document.execCommand('copy');selection.removeAllRanges();document.getElementById('copy').textContent='已复制内容'}})</script></body></html>`;
}
