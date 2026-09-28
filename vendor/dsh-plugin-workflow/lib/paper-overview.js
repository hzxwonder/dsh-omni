import { readFile } from 'node:fs/promises';
import rough from './vendor/rough.esm.mjs';

const W = 680;
const X = 44;
const CARD_W = W - X * 2;
const INK = '#273c49';
const MUTED = '#526773';
const BLUE = '#e0eef0';
const WARM = '#f9ead7';
const PAPER = '#fbf8f1';
const STROKE = '#416575';

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function lineWrap(value, max = 29) {
  const chars = [...String(value).trim()];
  const lines = [];
  const weight = ch => /[\u0000-\u007f]/.test(ch) ? 0.56 : 1;
  while (chars.length) {
    let width = 0;
    let end = 0;
    while (end < chars.length && width + weight(chars[end]) <= max) width += weight(chars[end++]);
    if (!end) end = 1;
    while (end < chars.length && /[。！？；，、,.!?;:：]/.test(chars[end])) end++;
    lines.push(chars.splice(0, end).join('').trim());
  }
  return lines;
}

function checkText(value, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[<>]/.test(value)) throw new Error('PAPER_OVERVIEW_INVALID');
  return value.trim();
}

export function validatePaperOverview(overview) {
  if (!overview || typeof overview !== 'object' || !Array.isArray(overview.steps) || overview.steps.length < 4 || overview.steps.length > 6) throw new Error('PAPER_OVERVIEW_INVALID');
  return {
    title: checkText(overview.title, 48),
    steps: overview.steps.map(step => ({ label: checkText(step.label, 12), title: checkText(step.title, 28), detail: checkText(step.detail, 58) })),
    evidence: checkText(overview.evidence, 72),
    boundary: checkText(overview.boundary, 72),
  };
}

function sceneElement(type, x, y, width, height, seed) {
  return { id: `${type}-${seed}`, type, x, y, width, height, angle: 0, strokeColor: STROKE,
    backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 2,
    opacity: 100, groupIds: [], frameId: null, index: `a${String(seed).padStart(4, '0')}`,
    roundness: null, seed, version: 1, versionNonce: seed * 7919, isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false };
}

function sceneText(x, y, width, height, value, size, color, seed) {
  return { ...sceneElement('text', x, y, width, height, seed), strokeColor: color,
    text: value, fontSize: size, fontFamily: 5, textAlign: 'left', verticalAlign: 'middle',
    containerId: null, originalText: value, autoResize: true, lineHeight: 1.25 };
}

function sceneCard(x, y, width, height, fill, seed) {
  return { ...sceneElement('rectangle', x, y, width, height, seed), backgroundColor: fill, roundness: { type: 3 } };
}

function sceneArrow(x, y, height, seed) {
  return { ...sceneElement('arrow', x, y, 0, height, seed), strokeColor: STROKE, strokeWidth: 2.6,
    points: [[0, 0], [0, height]], lastCommittedPoint: null, startBinding: null,
    endBinding: null, startArrowhead: null, endArrowhead: 'arrow', elbowed: false };
}

function svgText(x, y, value, size, color, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escape(value)}</text>`;
}

function roughCard(generator, x, y, width, height, fill, seed) {
  const radius = 17;
  const path = `M${x + radius} ${y} H${x + width - radius} Q${x + width} ${y} ${x + width} ${y + radius} V${y + height - radius} Q${x + width} ${y + height} ${x + width - radius} ${y + height} H${x + radius} Q${x} ${y + height} ${x} ${y + height - radius} V${y + radius} Q${x} ${y} ${x + radius} ${y} Z`;
  const drawable = generator.path(path, { stroke: STROKE, strokeWidth: 2.1, fill, fillStyle: 'solid', roughness: 1.4, bowing: 1, seed });
  return generator.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

export async function renderPaperOverview(input) {
  const overview = validatePaperOverview(input);
  const height = 442 + overview.steps.length * 176;
  const generator = rough.generator();
  const elements = [];
  const svg = [];
  const [latin, cjk] = await Promise.all([
    readFile(new URL('../assets/fonts/Excalifont-Latin.woff2', import.meta.url)),
    readFile(new URL('../assets/fonts/Xiaolai-DiagramSubset.woff2', import.meta.url)),
  ]);
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" role="img" aria-labelledby="overview-title overview-desc">`);
  svg.push(`<title id="overview-title">${escape(overview.title)}</title><desc id="overview-desc">${escape(overview.steps.map(s => `${s.label}：${s.title}。${s.detail}`).join('；') + `。证据：${overview.evidence}。边界：${overview.boundary}`)}</desc>`);
  svg.push(`<defs><style>@font-face{font-family:Excalifont;src:url(data:font/woff2;base64,${latin.toString('base64')}) format('woff2')}@font-face{font-family:Xiaolai;src:url(data:font/woff2;base64,${cjk.toString('base64')}) format('woff2')}text{font-family:Excalifont,Xiaolai,'Kaiti SC',KaiTi,cursive}</style><marker id="tip" markerWidth="12" markerHeight="12" refX="8" refY="6" orient="auto"><path d="M1 1 L9 6 L1 11" fill="none" stroke="${STROKE}" stroke-width="2"/></marker></defs>`);
  svg.push(`<rect width="${W}" height="${height}" fill="${PAPER}"/>`);
  svg.push(svgText(X, 55, overview.title, 29, INK));
  svg.push(svgText(X, 85, '问题 → 方法 → 证据 → 适用边界', 16, MUTED));
  elements.push(sceneText(X, 27, CARD_W, 40, overview.title, 29, INK, 1));
  elements.push(sceneText(X, 67, CARD_W, 25, '问题 → 方法 → 证据 → 适用边界', 16, MUTED, 2));
  overview.steps.forEach((step, index) => {
    const y = 112 + index * 176;
    const fill = index === 0 ? WARM : index === overview.steps.length - 1 ? '#dce9db' : BLUE;
    const seed = 100 + index * 10;
    elements.push(sceneCard(X, y, CARD_W, 148, fill, seed));
    elements.push(sceneText(X + 24, y + 12, CARD_W - 48, 20, `${String(index + 1).padStart(2, '0')}  ${step.label}`, 16, MUTED, seed + 1));
    elements.push(sceneText(X + 24, y + 36, CARD_W - 48, 30, step.title, 25, INK, seed + 2));
    elements.push(sceneText(X + 24, y + 72, CARD_W - 48, 68, step.detail, 16, MUTED, seed + 3));
    svg.push(roughCard(generator, X, y, CARD_W, 148, fill, seed));
    svg.push(svgText(X + 24, y + 30, `${String(index + 1).padStart(2, '0')}  ${step.label}`, 16, MUTED));
    svg.push(svgText(X + 24, y + 61, step.title, 25, INK));
    lineWrap(step.detail, 30).forEach((line, lineNo) => svg.push(svgText(X + 24, y + 86 + lineNo * 22, line, 16, MUTED)));
    if (index < overview.steps.length - 1) {
      elements.push(sceneArrow(W / 2, y + 151, 22, seed + 4));
      svg.push(`<path d="M${W / 2} ${y + 152} Q${W / 2 + 2} ${y + 162} ${W / 2} ${y + 170}" fill="none" stroke="${STROKE}" stroke-width="2.5" marker-end="url(#tip)"/>`);
    }
  });
  const footerY = 124 + overview.steps.length * 176;
  for (const [index, label, value, fill] of [[0, '论文证据', overview.evidence, '#e6eee8'], [1, '适用边界', overview.boundary, '#f5e9da']]) {
    const y = footerY + index * 146;
    elements.push(sceneCard(X, y, CARD_W, 132, fill, 800 + index * 10));
    elements.push(sceneText(X + 18, y + 10, CARD_W - 36, 25, label, 19, INK, 801 + index * 10));
    elements.push(sceneText(X + 18, y + 40, CARD_W - 36, 80, value, 16, MUTED, 802 + index * 10));
    svg.push(roughCard(generator, X, y, CARD_W, 132, fill, 800 + index * 10));
    svg.push(svgText(X + 18, y + 34, label, 19, INK));
    lineWrap(value, 34).forEach((line, lineNo) => svg.push(svgText(X + 18, y + 63 + lineNo * 22, line, 16, MUTED)));
  }
  svg.push('</svg>');
  return {
    svg: svg.join(''),
    scene: { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements,
      appState: { gridSize: null, viewBackgroundColor: PAPER, currentItemFontFamily: 5, currentItemRoughness: 2 }, files: {} },
  };
}
