import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const RESEARCH_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(RESEARCH_DIR, '../..')
const RUNTIME_SCAN_ROOTS = [
  path.join(REPO_ROOT, 'world-builder'),
  path.join(REPO_ROOT, 'src'),
]
const RUNTIME_SCAN_SKIP = new Set([
  path.join(REPO_ROOT, 'world-builder/research'),
])
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.vue', '.ts'])

const TRANSCRIPT_IMPORT_RE =
  /(?:from\s+['"][^'"]*(?:youtube-subtitles|research\/youtube-subtitles)[^'"]*['"]|require\s*\(\s*['"][^'"]*(?:youtube-subtitles|research\/youtube-subtitles)[^'"]*['"]\s*\)|\.en\.txt['"])/

function gitLsFiles(pattern) {
  const result = spawnSync('git', ['ls-files', pattern], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  assert.strictEqual(result.status, 0, result.stderr)
  return result.stdout.trim().split('\n').filter(Boolean)
}

async function walkSourceFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue
      }
      if ([...RUNTIME_SCAN_SKIP].some((skip) => fullPath.startsWith(skip))) {
        continue
      }
      await walkSourceFiles(fullPath, files)
      continue
    }
    const ext = path.extname(entry.name)
    if (SOURCE_EXTENSIONS.has(ext)) {
      files.push(fullPath)
    }
  }
  return files
}

test('root gitignore excludes bulk YouTube transcript artifacts', async () => {
  const gitignore = await readFile(path.join(REPO_ROOT, '.gitignore'), 'utf8')
  assert.match(gitignore, /world-builder\/research\/youtube-subtitles\/\*\.en\.txt/)
  assert.match(gitignore, /world-builder\/research\/youtube-subtitles\/raw\/\*/)
  assert.match(gitignore, /!world-builder\/research\/youtube-subtitles\/raw\/\.gitkeep/)
})

test('git index does not track bulk transcript .en.txt files', () => {
  const tracked = gitLsFiles('world-builder/research/youtube-subtitles/*.en.txt')
  assert.deepEqual(tracked, [])
})

test('research README documents playlist provenance and refresh commands', async () => {
  const readme = await readFile(path.join(RESEARCH_DIR, 'README.md'), 'utf8')
  assert.match(readme, /PLph_A8rBjLxXCs3Gc4-qQVVgN7nEsDIzg/)
  assert.match(readme, /yt-dlp/)
  assert.match(readme, /node scripts\/srt-to-transcript\.mjs/)
  assert.match(readme, /youtube-subtitles\/raw/)
})

test('transcript refresh script and directory scaffolding exist locally', async () => {
  await access(path.join(RESEARCH_DIR, 'scripts/srt-to-transcript.mjs'), constants.R_OK)
  await access(path.join(RESEARCH_DIR, 'youtube-subtitles/.gitkeep'), constants.R_OK)
  await access(path.join(RESEARCH_DIR, 'youtube-subtitles/raw/.gitkeep'), constants.R_OK)
})

test('runtime code does not import gitignored transcript files', async () => {
  const offenders = []
  for (const root of RUNTIME_SCAN_ROOTS) {
    const files = await walkSourceFiles(root)
    for (const filePath of files) {
      const content = await readFile(filePath, 'utf8')
      if (TRANSCRIPT_IMPORT_RE.test(content)) {
        offenders.push(path.relative(REPO_ROOT, filePath))
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `runtime must not import youtube-subtitles or .en.txt: ${offenders.join(', ')}`,
  )
})
