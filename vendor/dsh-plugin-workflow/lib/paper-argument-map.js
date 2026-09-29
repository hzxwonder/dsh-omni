import { readFile } from 'node:fs/promises';
import * as fontkit from 'fontkit';
import rough from './vendor/rough.esm.mjs';

const WIDTH = 760;
const INK = '#203943';
const MUTED = '#465e67';
const LINE = '#52727a';
const PAPER = '#fffdf8';
const PALETTES = [
  { fill: '#f0f5f3', accent: '#256d70' },
  { fill: '#f2f5f8', accent: '#486988' },
  { fill: '#f8f2ea', accent: '#99613e' },
  { fill: '#f4f1f7', accent: '#756486' },
];

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function check(value, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[<>\n\r]/.test(value)) throw new Error('PAPER_OVERVIEW_INVALID');
  return value.trim();
}

export function validatePaperArgumentMap(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.branches) || input.branches.length < 3 || input.branches.length > 4) throw new Error('PAPER_OVERVIEW_INVALID');
  return {
    title: check(input.title, 36),
    question: check(input.question, 52),
    thesis: check(input.thesis, 75),
    branches: input.branches.map(branch => ({
      role: check(branch.role, 12),
      title: check(branch.title, 20),
      problem: check(branch.problem, 52),
      insight: check(branch.insight, 52),
      method: check(branch.method, 68),
      source: check(branch.source, 26),
    })),
    evidence: {
      finding: check(input.evidence?.finding, 100),
      context: check(input.evidence?.context, 85),
      source: check(input.evidence?.source, 26),
    },
    boundary: {
      scope: check(input.boundary?.scope, 75),
      unknown: check(input.boundary?.unknown, 75),
    },
  };
}

function wrap(value, limit) {
  const chars = [...value];
  const lines = [];
  const weight = char => /[\u0000-\u007f]/.test(char) ? 0.54 : 1;
  while (chars.length) {
    let count = 0;
    let used = 0;
    while (count < chars.length && used + weight(chars[count]) <= limit) used += weight(chars[count++]);
    if (!count) count = 1;
    if (count < chars.length && /[A-Za-z0-9]/.test(chars[count - 1]) && /[A-Za-z0-9]/.test(chars[count])) {
      let boundary = count - 1;
      while (boundary > 0 && /[A-Za-z0-9-]/.test(chars[boundary - 1])) boundary--;
      if (boundary > count / 2) count = boundary;
    }
    while (count < chars.length && /[。！？；，、,.!?;:：]/.test(chars[count])) count++;
    lines.push(chars.splice(0, count).join('').trim());
  }
  return lines;
}

function element(type, x, y, width, height, seed, strokeColor = LINE) {
  return { id: `${type}-${seed}`, type, x, y, width, height, angle: 0, strokeColor,
    backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1.5, strokeStyle: 'solid', roughness: .5,
    opacity: 100, groupIds: [], frameId: null, index: `a${String(seed).padStart(4, '0')}`,
    roundness: null, seed, version: 1, versionNonce: seed * 7919, isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false };
}

function sceneText(x, baseline, width, value, size, color, seed) {
  return { ...element('text', x, baseline - size, width, size * 1.35, seed, color), text: value,
    fontSize: size, fontFamily: 2, textAlign: 'left', verticalAlign: 'middle', containerId: null,
    originalText: value, autoResize: false, lineHeight: 1.25 };
}

function sceneCard(x, y, width, height, fill, seed, accent) {
  return { ...element('rectangle', x, y, width, height, seed, accent), backgroundColor: fill, roundness: { type: 3 } };
}

function sceneLine(x1, y1, x2, y2, seed, color = LINE) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { ...element('line', x, y, Math.abs(x2 - x1), Math.abs(y2 - y1), seed, color),
    points: [[x1 - x, y1 - y], [x2 - x, y2 - y]], lastCommittedPoint: null };
}

function glyphText(font, x, baseline, value, size, color, maxWidth) {
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
  return `<g fill="${color}" transform="translate(${x} ${baseline}) scale(${scale} -${scale})">${paths}</g>`;
}

function roughCard(generator, x, y, width, height, fill, stroke, seed) {
  const radius = 16;
  const path = `M${x + radius} ${y} H${x + width - radius} Q${x + width} ${y} ${x + width} ${y + radius} V${y + height - radius} Q${x + width} ${y + height} ${x + width - radius} ${y + height} H${x + radius} Q${x} ${y + height} ${x} ${y + height - radius} V${y + radius} Q${x} ${y} ${x + radius} ${y} Z`;
  const drawable = generator.path(path, { stroke, strokeWidth: 1.25, fill, fillStyle: 'solid', roughness: .4, bowing: .18, seed });
  return generator.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

export async function renderPaperArgumentMap(input) {
  const map = validatePaperArgumentMap(input);
  const generator = rough.generator();
  const font = fontkit.create(await readFile(new URL('../assets/fonts/NotoSansSC-VF.ttf', import.meta.url))).getVariation({ wght: 400 });
  const elements = [];
  const contents = [];
  let seed = 1;
  const drawText = (x, baseline, value, size, color, maxWidth) => {
    contents.push(glyphText(font, x, baseline, value, size, color, maxWidth));
    elements.push(sceneText(x, baseline, maxWidth, value, size, color, seed++));
  };
  const drawLines = (x, baseline, value, size, color, maxWidth, chars, lineGap = 23) => {
    const lines = wrap(value, chars);
    lines.forEach((line, index) => drawText(x, baseline + index * lineGap, line, size, color, maxWidth));
    return lines.length;
  };
  const drawCard = (x, y, width, height, fill, stroke) => {
    contents.push(roughCard(generator, x, y, width, height, fill, stroke, seed));
    elements.push(sceneCard(x, y, width, height, fill, seed++, stroke));
  };
  const drawLine = (x1, y1, x2, y2, color = LINE) => {
    contents.push(`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/>`);
    elements.push(sceneLine(x1, y1, x2, y2, seed++, color));
  };

  const titleLines = drawLines(32, 54, map.title, 26, INK, 696, 25, 33);
  const questionY = 94 + (titleLines - 1) * 33;
  const questionHeight = 70 + wrap(map.question, 29).length * 27;
  drawCard(32, questionY, 696, questionHeight, '#f9f3e9', '#a47554');
  drawText(52, questionY + 28, '问题', 15, '#875737', 655);
  drawLines(52, questionY + 64, map.question, 22, INK, 650, 29, 27);
  const answerY = questionY + questionHeight + 16;
  const answerHeight = 70 + wrap(map.thesis, 32).length * 26;
  drawLine(380, questionY + questionHeight, 380, answerY, '#759a99');
  drawCard(32, answerY, 696, answerHeight, '#e9f3f0', '#2e7477');
  drawText(52, answerY + 28, '答案', 15, '#256d70', 655);
  drawLines(52, answerY + 62, map.thesis, 20, INK, 653, 32, 26);

  const branchX = 84;
  const branchWidth = 644;
  let y = answerY + answerHeight + 30;
  const branchCenters = [];
  map.branches.forEach((branch, index) => {
    const palette = PALETTES[index];
    const rows = [
      ['障碍', branch.problem],
      ['洞察', branch.insight],
      ['做法', branch.method],
    ].map(([label, value]) => ({ label, value, lines: wrap(value, 30) }));
    const height = 74 + rows.reduce((sum, row) => sum + Math.max(38, row.lines.length * 23 + 8), 0) + 15;
    const center = y + height / 2;
    branchCenters.push(center);
    drawCard(branchX, y, branchWidth, height, palette.fill, palette.accent);
    contents.push(`<rect x="${branchX + 1}" y="${y + 15}" width="5" height="${height - 30}" rx="2.5" fill="${palette.accent}"/>`);
    drawText(105, y + 30, branch.role, 15, palette.accent, 275);
    drawText(105, y + 61, branch.title, 22, INK, 478);
    drawLines(565, y + 28, branch.source, 13, MUTED, 135, 14, 16);
    let rowY = y + 90;
    rows.forEach((row, rowIndex) => {
      drawText(107, rowY, row.label, 15, palette.accent, 64);
      row.lines.forEach((line, lineIndex) => drawText(180, rowY + lineIndex * 23, line, 17, INK, 520));
      rowY += Math.max(38, row.lines.length * 23 + 8);
      if (rowIndex < 2) contents.push(`<path d="M180 ${rowY - 9} H700" stroke="#dce7e5" stroke-width="1"/>`);
    });
    y += height + 25;
  });
  drawLine(47, answerY + answerHeight, 47, branchCenters.at(-1), '#83a6a3');
  branchCenters.forEach((center, index) => {
    drawLine(47, center, 84, center, PALETTES[index].accent);
    contents.push(`<circle cx="47" cy="${center}" r="4" fill="${PALETTES[index].accent}"/>`);
  });

  y += 9;
  drawLine(47, branchCenters.at(-1), 47, y, '#83a6a3');
  const evidenceLines = wrap(map.evidence.finding, 33);
  const contextLines = wrap(map.evidence.context, 35);
  const evidenceHeight = 78 + evidenceLines.length * 23 + contextLines.length * 21;
  drawCard(32, y, 696, evidenceHeight, '#e9f2ec', '#538268');
  drawText(52, y + 31, '实验证据', 17, '#315f50', 500);
  drawLines(566, y + 28, map.evidence.source, 13, MUTED, 135, 14, 16);
  drawLines(52, y + 66, map.evidence.finding, 18, INK, 650, 33);
  drawLines(52, y + 66 + evidenceLines.length * 23, map.evidence.context, 15, MUTED, 650, 35, 21);
  drawLine(380, y + evidenceHeight, 380, y + evidenceHeight + 16, '#9aab99');
  y += evidenceHeight + 16;
  const scopeLines = wrap(map.boundary.scope, 34);
  const unknownLines = wrap(map.boundary.unknown, 34);
  const boundaryHeight = 79 + scopeLines.length * 22 + unknownLines.length * 22;
  drawCard(32, y, 696, boundaryHeight, '#fbf0e7', '#a47554');
  drawText(52, y + 31, '适用边界', 17, '#8c5c3e', 650);
  drawLines(52, y + 65, map.boundary.scope, 17, INK, 650, 34, 22);
  drawLines(52, y + 65 + scopeLines.length * 22, map.boundary.unknown, 15, MUTED, 650, 34, 22);
  const height = Math.ceil(y + boundaryHeight + 28);
  const description = [map.question, map.thesis, ...map.branches.map(branch => `${branch.role}：${branch.problem}；${branch.insight}；${branch.method}（${branch.source}）`),
    `证据：${map.evidence.finding}。${map.evidence.context}（${map.evidence.source}）`, `边界：${map.boundary.scope}。${map.boundary.unknown}`].join('；');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="overview-title overview-desc"><title id="overview-title">${escape(map.title)}</title><desc id="overview-desc">${escape(description)}</desc><rect width="${WIDTH}" height="${height}" fill="${PAPER}"/>${contents.join('')}</svg>`;
  return { svg, scene: { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements,
    appState: { gridSize: null, viewBackgroundColor: PAPER, currentItemFontFamily: 2, currentItemRoughness: .5 }, files: {} } };
}
