import { appIconPath, getInstallableAppForPath } from '../../share-metadata.js'

/** @param {string} value */
function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * @param {string} html
 * @param {'name' | 'property'} attrName
 * @param {string} keyValue
 */
function removeMeta(html, attrName, keyValue) {
  return html.replace(/<meta\b[^>]*>/gi, (match) => {
    const pattern = new RegExp(`\\b${attrName}=(?:"${keyValue}"|${keyValue})(?=[\\s>])`, 'i')
    return pattern.test(match) ? '' : match
  })
}

/**
 * @param {string} html
 * @param {'name' | 'property'} attrName
 * @param {string} keyValue
 * @param {string} content
 */
function setMeta(html, attrName, keyValue, content) {
  const stripped = removeMeta(html, attrName, keyValue)
  const tag = `<meta ${attrName}="${keyValue}" content="${escapeAttr(content)}" />`
  return stripped.replace('</head>', `    ${tag}\n  </head>`)
}

/** @param {string} html @param {string} title */
function setTitle(html, title) {
  const next = `<title>${escapeAttr(title)}</title>`
  if (/<title>[\s\S]*?<\/title>/i.test(html)) return html.replace(/<title>[\s\S]*?<\/title>/i, next)
  return html.replace('</head>', `    ${next}\n  </head>`)
}

/** @param {string} value */
function escapeJs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Relative prefix from a generated page back to the site base.
 * Pages live at `<base><shareSlug>/index.html`, so depth is the slug segment count.
 * @param {string} shareSlug
 * @returns {string}
 */
function basePrefix(shareSlug) {
  const depth = shareSlug.split('/').filter(Boolean).length
  return depth === 0 ? '' : '../'.repeat(depth)
}

/**
 * @param {string} html
 * @param {import('../../share-metadata.js').InstallableApp} app
 * @param {string} prefix
 */
function applyInstallTags(html, app, prefix) {
  const href = `${prefix}${app.manifestHref}`
  const appleTouchIcon = `${prefix}${appIconPath(app.iconId, 192)}`
  const tags = [
    `<link id="portfolio-manifest" rel="manifest" href="${escapeAttr(href)}" />`,
    `<link id="portfolio-apple-touch-icon" rel="apple-touch-icon" href="${escapeAttr(appleTouchIcon)}" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    `<meta name="apple-mobile-web-app-title" content="${escapeAttr(app.shortName)}" />`,
  ].join('\n    ')
  return html.replace('</head>', `    ${tags}\n  </head>`)
}

/**
 * @param {string} html
 * @param {import('../../share-metadata.js').ShareCatalogEntry} entry
 * @param {{ siteOrigin: string, pagesBase: string, siteName: string }} options
 */
export function buildShareHtml(html, entry, options) {
  const absoluteUrl = (relPath) => `${options.siteOrigin}${options.pagesBase}${String(relPath).replace(/^\/+/, '')}`
  const shareUrl = absoluteUrl(entry.shareSlug)
  const ogImageUrl = absoluteUrl(entry.ogImage)
  const hashTarget = entry.routePath === '/' ? `${options.pagesBase}#/` : `${options.pagesBase}#${entry.routePath}`

  let output = html
  output = setTitle(output, entry.title)
  output = setMeta(output, 'name', 'description', entry.description)
  output = setMeta(output, 'property', 'og:site_name', options.siteName)
  output = setMeta(output, 'property', 'og:title', entry.title)
  output = setMeta(output, 'property', 'og:description', entry.description)
  output = setMeta(output, 'property', 'og:image', ogImageUrl)
  output = setMeta(output, 'property', 'og:url', shareUrl)
  output = setMeta(output, 'name', 'twitter:title', entry.title)
  output = setMeta(output, 'name', 'twitter:description', entry.description)
  output = setMeta(output, 'name', 'twitter:image', ogImageUrl)
  output = output.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, '')
  output = output.replace('</head>', `    <link rel="canonical" href="${escapeAttr(shareUrl)}" />\n  </head>`)

  const app = getInstallableAppForPath(entry.routePath)
  if (app) output = applyInstallTags(output, app, basePrefix(entry.shareSlug))

  const redirectTag = `<script>(function(){if(window.location.hash)return;var target='${escapeJs(hashTarget)}';var qs=new URLSearchParams(window.location.search);if(qs.toString()){target=target+'?'+qs.toString();}window.location.replace(target);})();</script>`
  return output.replace(/<body(\s[^>]*)?>/i, (match) => `${match}\n    ${redirectTag}`)
}
