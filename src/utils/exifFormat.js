/**
 * Format raw exifr output for display (camera / exposure fields vary by file).
 */

const EXIF_CORE_KEYS = {
  model: ['Model', 'model'],
  lens: ['LensModel', 'lensModel', 'LensMake', 'lensMake'],
  focalLength: ['FocalLength', 'focalLength'],
  fNumber: ['FNumber', 'ApertureValue', 'fNumber'],
  exposureTime: ['ExposureTime', 'exposureTime'],
  iso: ['ISO', 'iso', 'ISOSpeedRatings'],
}

const EXIF_MAKE_KEYS = ['Make', 'make']

const EXIF_DATETIME_KEYS = [
  'DateTimeOriginal',
  'dateTimeOriginal',
  'CreateDate',
  'createDate',
  'ModifyDate',
  'modifyDate',
]

const EXIF_DIMENSION_WIDTH_KEYS = [
  'ExifImageWidth',
  'exifImageWidth',
  'ImageWidth',
  'imageWidth',
  'PixelXDimension',
  'pixelXDimension',
]

const EXIF_DIMENSION_HEIGHT_KEYS = [
  'ExifImageHeight',
  'exifImageHeight',
  'ImageHeight',
  'imageHeight',
  'PixelYDimension',
  'pixelYDimension',
]

const EXIF_DESCRIPTION_KEYS = ['ImageDescription', 'imageDescription', 'Description', 'description']

const EXIF_ARTIST_KEYS = ['Artist', 'artist']

const EXIF_COPYRIGHT_KEYS = ['Copyright', 'copyright']

function firstDefined(exif, keys) {
  for (const k of keys) {
    if (exif[k] != null && exif[k] !== '') {
      return exif[k]
    }
  }
  return null
}

/**
 * Core EXIF fields used in thumbnail hover
 * @returns {Record<string, unknown> | null}
 */
export function pickExifCore(exif) {
  if (!exif || typeof exif !== 'object') {
    return null
  }

  const core = {
    model: firstDefined(exif, EXIF_CORE_KEYS.model),
    lens: firstDefined(exif, EXIF_CORE_KEYS.lens),
    focalLength: firstDefined(exif, EXIF_CORE_KEYS.focalLength),
    fNumber: firstDefined(exif, EXIF_CORE_KEYS.fNumber),
    exposureTime: firstDefined(exif, EXIF_CORE_KEYS.exposureTime),
    iso: firstDefined(exif, EXIF_CORE_KEYS.iso),
  }

  const hasAny = Object.values(core).some((v) => v != null && v !== '')
  return hasAny ? core : null
}
function parseExifDateTime(value) {
  if (value == null || value === '') {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (typeof value === 'string') {
    const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(value.trim())
    if (m) {
      return new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
        parseInt(m[6], 10),
      )
    }

    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  return null
}

export function formatExifTimestamp(value) {
  const d = parseExifDateTime(value)
  if (!d) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function formatDimensions(exif) {
  const w = firstDefined(exif, EXIF_DIMENSION_WIDTH_KEYS)
  const h = firstDefined(exif, EXIF_DIMENSION_HEIGHT_KEYS)
  if (w != null && h != null) {
    return `${w} × ${h}`
  }
  if (w != null) {
    return String(w)
  }
  if (h != null) {
    return String(h)
  }
  return ''
}

function formatShutter(exposure) {
  if (exposure == null) {
    return ''
  }
  if (typeof exposure === 'number') {
    if (exposure >= 1) {
      return `${Number.isInteger(exposure) ? exposure : exposure.toFixed(1)}s`
    }
    const inv = Math.round(1 / exposure)
    return `1/${inv}s`
  }
  if (Array.isArray(exposure) && exposure.length >= 2) {
    const [n, d] = exposure
    if (d && n != null) {
      const sec = n / d
      return formatShutter(sec)
    }
  }
  return String(exposure)
}

function formatAperture(f) {
  if (f == null) {
    return ''
  }
  const n = typeof f === 'number' ? f : Number(f)
  if (Number.isFinite(n)) {
    return `f/${n.toFixed(1).replace(/\.0$/, '')}`
  }
  return String(f)
}

function formatFocal(mm) {
  if (mm == null) {
    return ''
  }
  const n = typeof mm === 'number' ? mm : Number(mm)
  if (Number.isFinite(n)) {
    return `${Math.round(n)}mm`
  }
  return String(mm)
}

function formatIso(iso) {
  if (iso == null) {
    return ''
  }
  return String(iso)
}

/** Short lines for thumbnail hover */
export function exifSummaryLines(exif) {
  const core = pickExifCore(exif)
  if (!core) {
    return []
  }

  const { model, lens, focalLength, fNumber, exposureTime, iso } = core

  const lines = []

  if (model) {
    lines.push(String(model))
  }

  const focal = formatFocal(focalLength)
  const aperture = formatAperture(fNumber)
  const shutter = formatShutter(exposureTime)
  const isoStr = iso != null ? `ISO ${formatIso(iso)}` : ''

  const exposureParts = [focal, aperture, shutter, isoStr].filter(Boolean)
  if (exposureParts.length) {
    lines.push(exposureParts.join(' · '))
  }

  if (lens && !lines.some((l) => l.includes(String(lens)))) {
    lines.push(String(lens))
  }

  return lines.slice(0, 3)
}

function pushRow(rows, label, value) {
  if (value == null || value === '') {
    return
  }
  const s = String(value).trim()
  if (s) {
    rows.push({ label, value: s })
  }
}

/**
 * Side panel: Make + richer metadata + exposure block
 * @returns {{ label: string, value: string }[]}
 */
export function exifToRows(exif) {
  if (!exif || typeof exif !== 'object') {
    return []
  }

  const rows = []

   const description = firstDefined(exif, EXIF_DESCRIPTION_KEYS)
  pushRow(rows, 'Description', description)

  const artist = firstDefined(exif, EXIF_ARTIST_KEYS)
  pushRow(rows, 'Artist', artist)

  const copyright = firstDefined(exif, EXIF_COPYRIGHT_KEYS)
  pushRow(rows, 'Copyright', copyright)

  const dateRaw = firstDefined(exif, EXIF_DATETIME_KEYS)
  const dateFormatted = formatExifTimestamp(dateRaw)
  pushRow(rows, 'Date taken', dateFormatted)

  const dims = formatDimensions(exif)
  pushRow(rows, 'Dimensions', dims)

  const make = firstDefined(exif, EXIF_MAKE_KEYS)
  pushRow(rows, 'Make', make)

  const core = pickExifCore(exif)
  if (core?.model) {
    pushRow(rows, 'Model', core.model)
  }

  if (core) {
    const technical = [
      { key: 'lens', label: 'Lens', format: 'string' },
      { key: 'focalLength', label: 'Focal length', format: 'focal' },
      { key: 'fNumber', label: 'Aperture', format: 'aperture' },
      { key: 'exposureTime', label: 'Shutter', format: 'shutter' },
      { key: 'iso', label: 'ISO', format: 'iso' },
    ]

    for (const { key, label, format } of technical) {
      const raw = core[key]
      if (raw == null || raw === '') {
        continue
      }

      let value = ''
      switch (format) {
        case 'focal':
          value = formatFocal(raw)
          break
        case 'aperture':
          value = formatAperture(raw)
          break
        case 'shutter':
          value = formatShutter(raw)
          break
        case 'iso':
          value = formatIso(raw)
          break
        default:
          value = String(raw)
      }

      pushRow(rows, label, value)
    }
  }

  return rows.length > 0 ? rows : []
}
