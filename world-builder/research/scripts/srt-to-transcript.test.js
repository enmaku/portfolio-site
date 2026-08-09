import assert from 'node:assert/strict'
import test from 'node:test'
import { srtToTranscript } from './srt-to-transcript.mjs'

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:02,000
Hello world this is a

2
00:00:02,000 --> 00:00:04,000
this is a rolling caption test.

3
00:00:04,000 --> 00:00:06,000
rolling caption test. [music] Done.
`

test('srtToTranscript deduplicates rolling captions and strips music markers', () => {
  const transcript = srtToTranscript(SAMPLE_SRT, { title: 'Sample Video' })
  assert.match(transcript, /^# Sample Video\n\n/)
  assert.doesNotMatch(transcript, /\[music\]/i)
  assert.match(transcript, /Hello world this is a rolling caption test\. Done\./)
})
