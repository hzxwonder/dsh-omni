import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPaperOverview } from '../lib/paper-overview.js';
import { insertPaperOverview, renderPaperMarkdown, renderWechatPage } from '../lib/paper-render.js';

const overview = {
  title: '一张图读懂论文逻辑',
  steps: [
    { label: '问题', title: '专家池大于显存', detail: '搬运形成瓶颈。' },
    { label: '预填', title: '双缓冲流水线', detail: '搬运与计算重叠。' },
    { label: '解码', title: '按带宽分工', detail: 'PCIe 与 CPU 并发。' },
    { label: '执行', title: '图内调度', detail: '控制留在设备上。' },
  ],
  evidence: '论文在六台机器上测试。',
  boundary: '机器带宽需要实测。',
};

test('paper renderer produces accessible math, adjacent Q/A and overview assets', async () => {
  const markdown = `# 论文精读\n\n## 论文信息\n\n- **题名：** Example Paper\n- **作者：** Example Author\n- **版本：** arXiv\n- **原文：** https://example.org/paper\n\n## 快速阅读\n\n- 问题：专家池超出显存。\n- 方法：带宽分工。\n\n${'一段清晰的简介。'.repeat(27)}\n\n## 方法\n\n$$\nq^* \\approx m \\frac{B_P}{B_H}\n$$\n\n> **Q：** 为什么要分工？\n>\n> **A：** 因为有两条执行路径。\n`;
  const withOverview = insertPaperOverview(markdown, '/lab/assets/paper-overviews/example-a1b2.svg');
  assert(withOverview.indexOf('论文逻辑总览图') < withOverview.indexOf('## 方法'));
  const rendered = renderPaperMarkdown(withOverview);
  assert.equal(rendered.formulas, 1);
  assert.equal(rendered.headings, 3);
  assert.match(rendered.html, /<math/);
  assert.match(rendered.html, /paper-qa-question/);
  assert.match(rendered.html, /class="paper-source"/);
  assert.match(rendered.html, /class="quick-read"/);
  assert.match(rendered.html, /class="paper-overview"/);
  assert.match(rendered.html, /Q：/);
  assert(!rendered.html.includes('<p>' + '一段清晰的简介。'.repeat(27) + '</p>'));
  const diagram = await renderPaperOverview(overview);
  assert.match(diagram.svg, /<svg/);
  assert.equal(diagram.scene.type, 'excalidraw');
  assert(diagram.scene.elements.some(element => element.type === 'arrow'));
  const wechat = renderWechatPage({ title: '论文精读', html: rendered.html, overviewSvg: diagram.svg });
  assert.match(wechat, /复制公众号排版/);
  assert.match(wechat, /text\/html/);
  assert.match(wechat, /data:image\/svg\+xml;base64/);
});

test('paper renderer rejects malformed math and unsafe HTML', () => {
  assert.throws(() => renderPaperMarkdown('# Title\n\n' + '正文'.repeat(60) + '\n\n$$\n\\unknowncommand{a}\n$$'), /KaTeX/);
  assert.throws(() => renderPaperMarkdown('# Title\n\n' + '正文'.repeat(60) + '<script>alert(1)</script>'), /PAPER_MARKDOWN_INVALID/);
});
