#!/usr/bin/env node
/**
 * Convert YouTube rolling-caption SRT dumps to plain-text transcripts.
 * Each SRT cue often repeats the previous cue's tail; this script keeps
 * only the new suffix per cue and formats readable paragraphs.
 */

import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBS_DIR = path.resolve(__dirname, '../youtube-subtitles');
const RAW_DIR = path.join(SUBS_DIR, 'raw');

const TIMESTAMP_RE = /^\d{2}:\d{2}:\d{2},\d{3}\s-->\s/;
const INDEX_RE = /^\d+$/;

function parseCueTexts(content) {
  const blocks = content.trim().split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trimEnd());
    const textLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || INDEX_RE.test(trimmed) || TIMESTAMP_RE.test(trimmed)) {
        continue;
      }
      textLines.push(trimmed);
    }

    if (textLines.length > 0) {
      cues.push(textLines.join(' '));
    }
  }

  return cues;
}

function cleanFragment(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s*>>\s*/g, '')
    .replace(/\s*>>\s*$/g, '')
    .trim();
}

function dedupeRollingCaptions(cues) {
  const parts = [];
  let prev = '';

  for (const raw of cues) {
    const cue = cleanFragment(raw);
    if (!cue) {
      continue;
    }

    let suffix = cue;
    if (prev) {
      let maxOverlap = 0;
      const limit = Math.min(prev.length, cue.length);
      for (let i = 1; i <= limit; i += 1) {
        if (prev.slice(-i) === cue.slice(0, i)) {
          maxOverlap = i;
        }
      }
      suffix = cue.slice(maxOverlap).trimStart();
    }

    if (suffix) {
      parts.push(suffix);
    }
    prev = cue;
  }

  return parts.join(' ');
}

function cleanTranscript(text) {
  return text
    .replace(/\s*\[music\]\s*/gi, ' ')
    .replace(/\s*>>\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toParagraphs(text, { maxSentences = 4 } = {}) {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [text];
  const paragraphs = [];
  let bucket = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }
    bucket.push(trimmed);
    if (bucket.length >= maxSentences) {
      paragraphs.push(bucket.join(' '));
      bucket = [];
    }
  }

  if (bucket.length > 0) {
    paragraphs.push(bucket.join(' '));
  }

  return paragraphs.join('\n\n');
}

function srtBasenameToTitle(basename) {
  const withoutExt = basename.replace(/\.en\.srt$/i, '');
  const withoutIndex = withoutExt.replace(/^\d{2}-/, '');
  return withoutIndex.replace(/-/g, ' ').trim();
}

export function srtToTranscript(content, { title } = {}) {
  const cues = parseCueTexts(content);
  const flat = cleanTranscript(dedupeRollingCaptions(cues));
  const body = toParagraphs(flat);
  const heading = title ? `# ${title}\n\n` : '';
  return `${heading}${body}\n`;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  const entries = (await readdir(SUBS_DIR)).filter((name) => name.endsWith('.en.srt'));
  const rawEntries = (await readdir(RAW_DIR).catch(() => [])).filter((name) =>
    name.endsWith('.en.srt'),
  );

  const names = [...new Set([...entries, ...rawEntries])];

  for (const name of names.sort()) {
    const srtPath = entries.includes(name)
      ? path.join(SUBS_DIR, name)
      : path.join(RAW_DIR, name);
    const rawPath = path.join(RAW_DIR, name);
    const txtPath = path.join(SUBS_DIR, name.replace(/\.srt$/i, '.txt'));

    const content = await readFile(srtPath, 'utf8');
    const title = srtBasenameToTitle(name);
    const transcript = srtToTranscript(content, { title });

    await writeFile(rawPath, content);
    await writeFile(txtPath, transcript);
    if (srtPath !== rawPath) {
      await unlink(srtPath).catch(() => {});
    }
    console.log(`${name} → ${path.basename(txtPath)} (${transcript.length} chars)`);
  }

  console.log(`\nProcessed ${names.length} SRT file(s); raw captions in youtube-subtitles/raw/`);
  console.log('Human-readable transcripts are youtube-subtitles/*.en.txt');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}