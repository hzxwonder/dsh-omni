import { readFile } from 'node:fs/promises';
import * as fontkit from 'fontkit';
import rough from './vendor/rough.esm.mjs';

const WIDTH = 820;
const HEIGHT = 752;
const INK = '#263b45';
const MUTED = '#526670';
const STROKE = '#56717b';
const PAPER = '#fffdf8';
const CARD = { width: 240, height: 138, rows: [126, 282, 438] };

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function wrap(value, max = 18) {
  const chars = [...String(value).trim()];
  const lines = [];
  const width = ch => /[\u0000-\u007f]/.test(ch) ? .56 : 1;
  while (chars.length) {
    let length = 0;
    let count = 0;
    while (count < chars.length && length + width(chars[count]) <= max) length += width(chars[count++]);
    if (!count) count = 1;
    while (count < chars.length && /[。！？；，、,.!?;:：]/.test(chars[count])) count++;
    lines.push(chars.splice(0, count).join('').trim());
  }
  return lines;
}

function checkText(value, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[<>]/.test(value)) throw new Error('PAPER_OVERVIEW_INVALID');
  return value.trim();
}

export function validatePaperOverview(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.steps) || input.steps.length < 4 || input.steps.length > 6) throw new Error('PAPER_OVERVIEW_INVALID');
  return {
    title: checkText(input.title, 48),
    steps: input.steps.map(step => ({ label: checkText(step.label, 12), title: checkText(step.title, 28), detail: checkText(step.detail, 58) })),
    evidence: checkText(input.evidence, 72),
    boundary: checkText(input.boundary, 72),
  };
}

function sceneElement(type, x, y, width, height, seed) {
  return { id: `${type}-${seed}`, type, x, y, width, height, angle: 0, strokeColor: STROKE,
    backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1,
    opacity: 100, groupIds: [], frameId: null, index: `a${String(seed).padStart(4, '0')}`,
    roundness: null, seed, version: 1, versionNonce: seed * 7919, isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false };
}

function sceneText(x, y, width, height, value, size, color, seed) {
  return { ...sceneElement('text', x, y, width, height, seed), strokeColor: color,
    text: value, fontSize: size, fontFamily: 2, textAlign: 'left', verticalAlign: 'middle',
    containerId: null, originalText: value, autoResize: false, lineHeight: 1.22 };
}

function sceneCard(x, y, width, height, fill, seed) {
  return { ...sceneElement('rectangle', x, y, width, height, seed), backgroundColor: fill, roundness: { type: 3 } };
}

function sceneBranch(fromX, fromY, toX, toY, seed) {
  const x = Math.min(fromX, toX);
  const y = Math.min(fromY, toY);
  return { ...sceneElement('line', x, y, Math.abs(fromX - toX), Math.abs(fromY - toY), seed),
    strokeWidth: 2.5, points: [[fromX - x, fromY - y], [toX - x, toY - y]], lastCommittedPoint: null };
}

function svgText(font, x, y, value, size, color, maxWidth) {
  const run = font.layout(value);
  const advance = run.positions.reduce((sum, position) => sum + position.xAdvance, 0);
  const scale = Math.min(size / font.unitsPerEm, maxWidth / Math.max(1, advance));
  let offset = 0;
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const path = glyph.path.toSVG();
    const segment = path ? `<path d="${path}" transform="translate(${offset + position.xOffset} ${position.yOffset})"/>` : '';
    offset += position.xAdvance;
    return segment;
  }).join('');
  return `<g fill="${color}" transform="translate(${x} ${y}) scale(${scale} -${scale})">${paths}</g>`;
}

function roughCard(generator, x, y, width, height, fill, seed, emphasis = false) {
  const radius = 15;
  const path = `M${x + radius} ${y} H${x + width - radius} Q${x + width} ${y} ${x + width} ${y + radius} V${y + height - radius} Q${x + width} ${y + height} ${x + width - radius} ${y + height} H${x + radius} Q${x} ${y + height} ${x} ${y + height - radius} V${y + radius} Q${x} ${y} ${x + radius} ${y} Z`;
  const drawable = generator.path(path, { stroke: STROKE, strokeWidth: emphasis ? 2.2 : 1.7, fill, fillStyle: 'solid', roughness: .65, bowing: .35, seed });
  return generator.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

export async function renderPaperOverview(input) {
  const overview = validatePaperOverview(input);
  const generator = rough.generator();
  const elements = [];
  const svg = [];
  const font = fontkit.create(await readFile(new URL('../assets/fonts/NotoSansSC-VF.ttf', import.meta.url))).getVariation({ wght: 400 });
  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="overview-title overview-desc">`);
  svg.push(`<title id="overview-title">${escape(overview.title)}</title><desc id="overview-desc">${escape(overview.steps.map(s => `${s.label}：${s.title}。${s.detail}`).join('；') + `。论文证据：${overview.evidence}。适用边界：${overview.boundary}`)}</desc>`);
  svg.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>`);
  svg.push(svgText(font, 34, 48, '论文逻辑总览', 30, INK, WIDTH - 68));
  svg.push(svgText(font, 35, 79, '一眼看懂问题、设计选择与证据', 15, MUTED, WIDTH - 70));
  elements.push(sceneText(34, 18, WIDTH - 68, 38, '论文逻辑总览', 30, INK, 1));
  elements.push(sceneText(35, 59, WIDTH - 70, 24, '一眼看懂问题、设计选择与证据', 15, MUTED, 2));

  const core = { x: 298, y: 292, width: 224, height: 132 };
  const coreFill = '#e5f0ed';
  svg.push(roughCard(generator, core.x, core.y, core.width, core.height, coreFill, 20, true));
  svg.push(svgText(font, core.x + 22, core.y + 37, '核心思路', 17, MUTED, core.width - 44));
  wrap(overview.title, 12).slice(0, 4).forEach((line, i) => svg.push(svgText(font, core.x + 22, core.y + 62 + i * 19, line, 17, INK, core.width - 44)));
  elements.push(sceneCard(core.x, core.y, core.width, core.height, coreFill, 20));
  elements.push(sceneText(core.x + 22, core.y + 17, core.width - 44, 27, '核心思路', 17, MUTED, 21));
  elements.push(sceneText(core.x + 22, core.y + 45, core.width - 44, 82, wrap(overview.title, 12).slice(0, 4).join('\n'), 17, INK, 22));

  overview.steps.forEach((step, index) => {
    const left = index % 2 === 0;
    const row = Math.floor(index / 2);
    const x = left ? 26 : WIDTH - 26 - CARD.width;
    const y = CARD.rows[row];
    const fill = index === 0 ? '#fbecda' : index === overview.steps.length - 1 ? '#e7eee0' : '#e8f1f2';
    const seed = 100 + index * 10;
    const fromX = left ? core.x : core.x + core.width;
    const fromY = core.y + core.height / 2 + (row - 1) * 18;
    const toX = left ? x + CARD.width : x;
    const toY = y + CARD.height / 2;
    const bend = left ? -34 : 34;
    svg.push(`<path d="M${fromX} ${fromY} C${fromX + bend} ${fromY},${toX - bend} ${toY},${toX} ${toY}" fill="none" stroke="${STROKE}" stroke-width="2.3" stroke-linecap="round"/>`);
    svg.push(`<circle cx="${toX}" cy="${toY}" r="4" fill="${STROKE}"/>`);
    elements.push(sceneBranch(fromX, fromY, toX, toY, seed + 4));
    svg.push(roughCard(generator, x, y, CARD.width, CARD.height, fill, seed));
    svg.push(svgText(font, x + 15, y + 24, `${String(index + 1).padStart(2, '0')}  ${step.label}`, 14, MUTED, CARD.width - 30));
    svg.push(svgText(font, x + 15, y + 51, step.title, 20, INK, CARD.width - 30));
    wrap(step.detail, 17).slice(0, 4).forEach((line, i) => svg.push(svgText(font, x + 15, y + 76 + i * 17, line, 13, MUTED, CARD.width - 30)));
    elements.push(sceneCard(x, y, CARD.width, CARD.height, fill, seed));
    elements.push(sceneText(x + 15, y + 8, CARD.width - 30, 23, `${String(index + 1).padStart(2, '0')}  ${step.label}`, 14, MUTED, seed + 1));
    elements.push(sceneText(x + 15, y + 32, CARD.width - 30, 29, step.title, 20, INK, seed + 2));
    elements.push(sceneText(x + 15, y + 64, CARD.width - 30, 69, wrap(step.detail, 17).slice(0, 4).join('\n'), 13, MUTED, seed + 3));
  });

  for (const [index, label, value, fill] of [[0, '论文证据', overview.evidence, '#e8f1e9'], [1, '适用边界', overview.boundary, '#f8eadc']]) {
    const x = index === 0 ? 26 : 420;
    const y = 604;
    const width = 374;
    const height = 124;
    const seed = 800 + index * 10;
    const fromX = index === 0 ? core.x + 70 : core.x + core.width - 70;
    const toX = x + width / 2;
    svg.push(`<path d="M${fromX} ${core.y + core.height} C${fromX} 571,${toX} 571,${toX} ${y}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`);
    elements.push(sceneBranch(fromX, core.y + core.height, toX, y, seed + 4));
    svg.push(roughCard(generator, x, y, width, height, fill, seed));
    svg.push(svgText(font, x + 17, y + 29, label, 18, INK, width - 34));
    wrap(value, 25).slice(0, 4).forEach((line, i) => svg.push(svgText(font, x + 17, y + 56 + i * 19, line, 14, MUTED, width - 34)));
    elements.push(sceneCard(x, y, width, height, fill, seed));
    elements.push(sceneText(x + 17, y + 10, width - 34, 28, label, 18, INK, seed + 1));
    elements.push(sceneText(x + 17, y + 42, width - 34, 76, wrap(value, 25).slice(0, 4).join('\n'), 14, MUTED, seed + 2));
  }
  svg.push('</svg>');
  return { svg: svg.join(''), scene: { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements,
    appState: { gridSize: null, viewBackgroundColor: PAPER, currentItemFontFamily: 2, currentItemRoughness: 1 }, files: {} } };
}
