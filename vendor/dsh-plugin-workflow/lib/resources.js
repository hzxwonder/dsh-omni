import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fail } from './definition.js';

const skillName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nodeId = /^[a-zA-Z0-9_-]{1,80}$/;
const blobId = /^[a-f0-9]{64}$/;
const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_TEXT = 200_000;
const folders = ['assets', 'references', 'scripts'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value)) fail('RESOURCE_PATH_INVALID', String(value));
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) fail('RESOURCE_PATH_INVALID', value);
  return value;
}

function fileEntry(entry) {
  if (!entry || typeof entry !== 'object') fail('RESOURCE_FILE_INVALID');
  relativeFile(entry.path);
  if (entry.content === undefined && !blobId.test(entry.blob ?? '')) fail('RESOURCE_CONTENT_REQUIRED', entry.path);
  if (entry.content !== undefined && (typeof entry.content !== 'string' || entry.content.length > MAX_TEXT || entry.blob)) fail('RESOURCE_CONTENT_INVALID', entry.path);
  return entry;
}

export function validateResources(def) {
  const names = new Set();
  for (const node of def.nodes) {
    if (node.kind === 'skill') {
      const skill = node.skill;
      if (!skill || !skillName.test(skill.name ?? '') || skill.name.length > 64) fail('SKILL_NAME_INVALID', node.id);
      if (names.has(skill.name)) fail('SKILL_NAME_DUPLICATE', skill.name);
      names.add(skill.name);
      if (typeof skill.description !== 'string' || !skill.description.trim() || skill.description.length > 1024) fail('SKILL_DESCRIPTION_REQUIRED', node.id);
      if (typeof skill.instructions !== 'string' || !skill.instructions.trim() || skill.instructions.length > MAX_TEXT) fail('SKILL_INSTRUCTIONS_REQUIRED', node.id);
      if (!Array.isArray(skill.files) || skill.files.length > 80) fail('SKILL_FILES_INVALID', node.id);
      const seen = new Set();
      for (const entry of skill.files) {
        fileEntry(entry);
        const folded = entry.path.toLocaleLowerCase('en');
        if (!folders.some(folder => entry.path.startsWith(folder + '/')) || seen.has(folded) || entry.path.endsWith('/SKILL.md')) fail('SKILL_FILE_PATH_INVALID', entry.path);
        seen.add(folded);
      }
      if (skill.files.some(entry => skill.files.some(other => other !== entry && other.path.toLocaleLowerCase('en').startsWith(entry.path.toLocaleLowerCase('en') + '/')))) fail('SKILL_FILE_PATH_INVALID', node.id);
    }
    if (node.kind === 'file') {
      if (!node.file || typeof node.file.name !== 'string') fail('FILE_NAME_REQUIRED', node.id);
      fileEntry({ ...node.file, path: node.file.name });
      if (node.file.name.includes('/')) fail('FILE_NAME_INVALID', node.id);
    }
  }
}

export function renderSkill(skill) {
  return `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description.trim())}\n---\n\n${skill.instructions.trim()}\n`;
}

export class WorkflowResources {
  constructor(workspaceRoot, storeRoot) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.blobRoot = join(resolve(storeRoot), 'resource-blobs');
  }
  blobPath(id) {
    if (!blobId.test(id ?? '')) fail('RESOURCE_BLOB_INVALID');
    return join(this.blobRoot, id.slice(0, 2), id);
  }
  async upload(base64) {
    if (typeof base64 !== 'string' || base64.length > MAX_UPLOAD * 1.4 + 8 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) fail('RESOURCE_UPLOAD_INVALID');
    const data = Buffer.from(base64, 'base64');
    if (data.length > MAX_UPLOAD) fail('RESOURCE_UPLOAD_TOO_LARGE');
    const blob = digest(data);
    const path = this.blobPath(blob);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, data, { flag: 'wx', mode: 0o600 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    return { blob, bytes: data.length };
  }
  async readText(blob) {
    const data = await readFile(this.blobPath(blob));
    if (data.length > MAX_TEXT || data.includes(0)) fail('RESOURCE_NOT_TEXT');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return { content: text };
  }
  revisionRoot(def, revision) {
    if (!nodeId.test(def.id ?? '') || !Number.isInteger(revision) || revision < 1) fail('RESOURCE_REVISION_INVALID');
    return join(this.workspaceRoot, def.id, '.workflow', 'revisions', String(revision));
  }
  paths(def, revision) {
    const root = this.revisionRoot(def, revision);
    return Object.fromEntries(def.nodes.filter(node => node.kind === 'skill' || node.kind === 'file').map(node => [node.id, node.kind === 'skill'
      ? join(root, 'skills', node.skill.name)
      : join(root, 'files', node.id, node.file.name)]));
  }
  async verifyBlobs(def) {
    validateResources(def);
    for (const node of def.nodes) {
      const entries = node.kind === 'skill' ? node.skill.files : node.kind === 'file' ? [node.file] : [];
      for (const entry of entries) if (entry.blob) {
        const data = await readFile(this.blobPath(entry.blob)).catch(() => null);
        if (!data || data.length > MAX_UPLOAD || digest(data) !== entry.blob) fail('RESOURCE_BLOB_MISSING', entry.blob);
      }
    }
  }
  async materialize(snapshot) {
    const def = snapshot.definition;
    if (!def.nodes.some(node => node.kind === 'skill' || node.kind === 'file')) return {};
    await this.verifyBlobs(def);
    const root = this.revisionRoot(def, snapshot.revision);
    const marker = join(root, '.snapshot.json');
    const prior = await readFile(marker, 'utf8').catch(() => null);
    if (prior) {
      try {
        if (JSON.parse(prior).hash === snapshot.hash) {
          for (const node of def.nodes) {
            const files = node.kind === 'skill'
              ? [[join(root, 'skills', node.skill.name, 'SKILL.md'), { content: renderSkill(node.skill) }],
                  ...node.skill.files.map(entry => [join(root, 'skills', node.skill.name, entry.path), entry])]
              : node.kind === 'file' ? [[join(root, 'files', node.id, node.file.name), node.file]] : [];
            for (const [path, entry] of files) {
              const actual = await readFile(path);
              const expected = entry.blob ?? digest(Buffer.from(entry.content));
              if (digest(actual) !== expected) fail('RESOURCE_REVISION_CHANGED', path);
            }
          }
          return this.paths(def, snapshot.revision);
        }
      } catch (error) { if (error.code === 'RESOURCE_REVISION_CHANGED') throw error; }
      fail('RESOURCE_REVISION_CONFLICT', root);
    }
    const stage = root + '.stage-' + randomUUID();
    const put = async (path, entry) => {
      if (!path.startsWith(stage + sep)) fail('RESOURCE_PATH_INVALID');
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      if (entry.blob) await copyFile(this.blobPath(entry.blob), path);
      else await writeFile(path, entry.content, { mode: 0o600 });
    };
    try {
      await mkdir(stage, { recursive: true, mode: 0o700 });
      for (const node of def.nodes) {
        if (node.kind === 'skill') {
          const folder = join(stage, 'skills', node.skill.name);
          await mkdir(folder, { recursive: true, mode: 0o700 });
          await put(join(folder, 'SKILL.md'), { content: renderSkill(node.skill) });
          for (const name of folders) await mkdir(join(folder, name), { recursive: true, mode: 0o700 });
          for (const entry of node.skill.files) await put(join(folder, entry.path), entry);
        }
        if (node.kind === 'file') await put(join(stage, 'files', node.id, node.file.name), node.file);
      }
      await writeFile(join(stage, '.snapshot.json'), JSON.stringify({ hash: snapshot.hash }), { mode: 0o600 });
      await mkdir(dirname(root), { recursive: true, mode: 0o700 });
      await rename(stage, root).catch(async error => {
        if (error.code !== 'EEXIST' && error.code !== 'ENOTEMPTY') throw error;
        const competing = await readFile(marker, 'utf8').catch(() => null);
        if (!competing || JSON.parse(competing).hash !== snapshot.hash) fail('RESOURCE_REVISION_CONFLICT', root);
      });
      return this.paths(def, snapshot.revision);
    } finally { await rm(stage, { recursive: true, force: true }); }
  }
}
