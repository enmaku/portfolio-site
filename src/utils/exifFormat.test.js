import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exifSummaryLines,
  exifToRows,
  formatExifTimestamp,
  pickExifCore,
} from './exifFormat.js'

test('pickExifCore returns core camera fields from full metadata', () => {
  const core = pickExifCore({
    Model: 'X-T5',
    LensModel: 'XF35mmF1.4 R',
    FocalLength: 35,
    FNumber: 2.8,
    ExposureTime: 0.008,
    ISO: 400,
  })

  assert.deepEqual(core, {
    model: 'X-T5',
    lens: 'XF35mmF1.4 R',
    focalLength: 35,
    fNumber: 2.8,
    exposureTime: 0.008,
    iso: 400,
  })
})

test('pickExifCore returns null for null or non-object input', () => {
  assert.equal(pickExifCore(null), null)
  assert.equal(pickExifCore(undefined), null)
  assert.equal(pickExifCore('not-an-object'), null)
})

test('formatExifTimestamp formats EXIF colon datetime', () => {
  const formatted = formatExifTimestamp('2024:06:10 14:30:00')
  assert.ok(formatted.length > 0)
  assert.match(formatted, /2024/)
  assert.match(formatted, /June|Jun/)
})

test('formatExifTimestamp returns empty string for invalid input', () => {
  assert.equal(formatExifTimestamp(null), '')
  assert.equal(formatExifTimestamp(''), '')
  assert.equal(formatExifTimestamp('not-a-date'), '')
})

const fullExifFixture = {
  Model: 'X-T5',
  LensModel: 'XF35mmF1.4 R',
  FocalLength: 35,
  FNumber: 2.8,
  ExposureTime: 0.008,
  ISO: 400,
  latitude: 37.7749,
  longitude: -122.4194,
  GPSLatitude: 37.7749,
  GPSLongitude: -122.4194,
}

test('exifSummaryLines returns model and exposure summary for full metadata', () => {
  const lines = exifSummaryLines(fullExifFixture)

  assert.ok(lines.length >= 2)
  assert.equal(lines[0], 'X-T5')
  assert.ok(lines[1].includes('35mm'))
  assert.ok(lines[1].includes('f/2.8'))
  assert.ok(lines[1].includes('ISO 400'))
  assert.equal(lines.at(-1), 'XF35mmF1.4 R')
})

test('exifSummaryLines returns empty array for null or empty metadata', () => {
  assert.deepEqual(exifSummaryLines(null), [])
  assert.deepEqual(exifSummaryLines({}), [])
})

test('exifSummaryLines never includes GPS coordinates in output', () => {
  const lines = exifSummaryLines(fullExifFixture)
  const joined = lines.join(' ')

  assert.ok(!joined.includes('37.7749'))
  assert.ok(!joined.includes('-122.4194'))
  assert.ok(!/latitude|longitude/i.test(joined))
})

test('pickExifCore accepts alternate key casings', () => {
  const core = pickExifCore({
    model: 'Lowercase Model',
    focalLength: 50,
  })

  assert.equal(core?.model, 'Lowercase Model')
  assert.equal(core?.focalLength, 50)
})

test('exifSummaryLines formats fractional exposure array as shutter speed', () => {
  const lines = exifSummaryLines({
    Model: 'TestCam',
    ExposureTime: [1, 125],
    ISO: 200,
  })

  assert.equal(lines.length, 2)
  assert.ok(lines[1].includes('1/125s'))
})

test('exifSummaryLines returns model-only line for partial metadata', () => {
  const lines = exifSummaryLines({ Model: 'Solo Camera' })

  assert.deepEqual(lines, ['Solo Camera'])
})

test('exifToRows returns label-value rows for full metadata', () => {
  const rows = exifToRows({
    ...fullExifFixture,
    Make: 'FUJIFILM',
    DateTimeOriginal: '2024:06:10 14:30:00',
    ExifImageWidth: 6240,
    ExifImageHeight: 4160,
  })

  const labels = rows.map((row) => row.label)

  assert.ok(labels.includes('Make'))
  assert.ok(labels.includes('Model'))
  assert.ok(labels.includes('Date taken'))
  assert.ok(labels.includes('Dimensions'))
  assert.ok(labels.includes('Shutter'))
  assert.equal(rows.find((row) => row.label === 'Dimensions')?.value, '6240 × 4160')
})

test('exifToRows returns empty array for null input', () => {
  assert.deepEqual(exifToRows(null), [])
})

test('exifToRows never includes GPS location rows', () => {
  const rows = exifToRows(fullExifFixture)
  const labels = rows.map((row) => row.label)
  const values = rows.map((row) => row.value).join(' ')

  assert.ok(!labels.some((label) => /gps|latitude|longitude|location/i.test(label)))
  assert.ok(!values.includes('37.7749'))
  assert.ok(!values.includes('-122.4194'))
})
