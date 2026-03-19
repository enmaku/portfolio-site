/**
 * Format raw exifr output for display (camera / exposure fields vary by file).
 */

/** Same keys used for thumbnail hover summary and side panel (whitelist). */
const EXIF_CORE_KEYS = {
  model: ['Model', 'model'],
  lens: ['LensModel', 'lensModel', 'LensMake', 'lensMake'],
  focalLength: ['FocalLength', 'focalLength'],
  fNumber: ['FNumber', 'ApertureValue', 'fNumber'],
  exposureTime: ['ExposureTime', 'exposureTime'],
  iso: ['ISO', 'iso', 'ISOSpeedRatings'],
}

function firstDefined(exif, keys) {
  for (const k of keys) {
    if (exif[k] != null && exif[k] !== '') {
      return exif[k]
    }
  }
  return null
}

/**
 * Core EXIF fields used in thumbnail + panel (single source of truth).
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
    return ['No EXIF data']
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

  if (lines.length === 0) {
    lines.push('No EXIF data')
  }

  return lines.slice(0, 3)
}

/** Side panel rows
 * @returns {{ label: string, value: string }[]}
 */
export function exifToRows(exif) {
  const core = pickExifCore(exif)
  if (!core) {
    return []
  }

  const whitelist = [
    { key: 'model', label: 'Model', format: 'string' },
    { key: 'lens', label: 'Lens', format: 'string' },
    { key: 'focalLength', label: 'Focal length', format: 'focal' },
    { key: 'fNumber', label: 'Aperture', format: 'aperture' },
    { key: 'exposureTime', label: 'Shutter', format: 'shutter' },
    { key: 'iso', label: 'ISO', format: 'iso' },
  ]

  const rows = []

  for (const { key, label, format } of whitelist) {
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

    if (value) {
      rows.push({ label, value })
    }
  }

  return rows
}
