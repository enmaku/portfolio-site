import exifr from 'exifr'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { usePointerDragScroll } from 'src/composables/usePointerDragScroll.js'
import { exifSummaryLines, exifToRows } from 'src/utils/exifFormat.js'

const googlePhotosUrl = 'https://photos.app.goo.gl/pjuSWsZbgcp3eC7o6'

const photoModules = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const thumbModules = import.meta.glob('../assets/photos/thumbs/*.{webp,jpg,jpeg,png}', {
  eager: true,
  import: 'default',
})

const thumbByLabel = new Map(
  Object.entries(thumbModules).map(([path, url]) => {
    const file = path.split('/').pop() || ''
    const label = file.replace(/\.[^.]+$/, '')
    return [label, url]
  }),
)

const basePhotos = Object.entries(photoModules)
  .map(([path, src]) => {
    const file = path.split('/').pop() || ''
    const label = file.replace(/\.[^.]+$/, '')
    const thumbSrc = thumbByLabel.get(label) ?? src
    return { src, thumbSrc, label }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

const exifCache = new Map()

/** @type {{ portfolioImagePreview: true }} */
const PREVIEW_HISTORY_STATE = { portfolioImagePreview: true }

function getImageRatio(src) {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img.naturalWidth / img.naturalHeight)
        return
      }

      resolve(1)
    }

    img.onerror = () => {
      resolve(1)
    }

    img.src = src
  })
}

async function loadExif(src) {
  if (exifCache.has(src)) {
    return exifCache.get(src)
  }

  try {
    const data = await exifr.parse(src, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      icc: false,
      mergeOutput: true,
    })
    const normalized = data && typeof data === 'object' ? data : null
    exifCache.set(src, normalized)
    return normalized
  } catch {
    exifCache.set(src, null)
    return null
  }
}

export function usePhotoGallery() {
  const photos = ref([])

  const galleryReady = ref(basePhotos.length === 0)
  const loadProgress = ref(0)
  const loadedCount = ref(0)

  const hoveredPhotoSrc = ref('')
  const thumbExifLines = ref([])

  const dialogOpen = ref(false)
  const previewHistoryPushed = ref(false)
  const ignoreNextPopstate = ref(false)
  const galleryScrollRestore = ref({ x: 0, y: 0 })

  const dialogSrc = ref('')
  const dialogLabel = ref('')
  const exifPanelOpen = ref(true)
  const dialogExifRows = ref([])
  const isZoomed = ref(false)
  const dialogImageWrap = ref(null)

  const { dragActive: isDragging, handlers: imageDragHandlers } = usePointerDragScroll({
    scrollElRef: dialogImageWrap,
    axis: 'both',
    scrollBeforeThreshold: true,
    shouldBegin: () => isZoomed.value,
  })

  function restoreGalleryScroll() {
    const { x, y } = galleryScrollRestore.value
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(x, y)
        })
      })
    })
  }

  function onBrowserPopState() {
    if (ignoreNextPopstate.value) {
      ignoreNextPopstate.value = false
      return
    }

    if (dialogOpen.value) {
      dialogOpen.value = false
      previewHistoryPushed.value = false
      restoreGalleryScroll()
    }
  }

  function onThumbEnter(photo) {
    hoveredPhotoSrc.value = photo.src
    thumbExifLines.value = []

    void loadExif(photo.src).then((exif) => {
      if (hoveredPhotoSrc.value !== photo.src) {
        return
      }

      thumbExifLines.value = exifSummaryLines(exif)
    })
  }

  function onThumbLeave() {
    hoveredPhotoSrc.value = ''
    thumbExifLines.value = []
  }

  async function openPhoto(photo) {
    dialogSrc.value = photo.src
    dialogLabel.value = photo.label
    isZoomed.value = false
    imageDragHandlers.onEnd()
    dialogExifRows.value = []
    galleryScrollRestore.value = {
      x: window.scrollX,
      y: window.scrollY,
    }
    previewHistoryPushed.value = true
    history.pushState(PREVIEW_HISTORY_STATE, '')
    dialogOpen.value = true

    const exif = await loadExif(photo.src)
    dialogExifRows.value = exifToRows(exif)
    exifPanelOpen.value = true
  }

  function toggleZoom() {
    const shouldZoomIn = isZoomed.value === false
    isZoomed.value = !isZoomed.value
    imageDragHandlers.onEnd()

    if (shouldZoomIn) {
      void centerZoomedImage()
    }
  }

  async function centerZoomedImage() {
    await nextTick()

    if (dialogImageWrap.value === null) {
      return
    }

    requestAnimationFrame(() => {
      if (dialogImageWrap.value === null) {
        return
      }

      const wrap = dialogImageWrap.value
      wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2)
      wrap.scrollTop = Math.max(0, (wrap.scrollHeight - wrap.clientHeight) / 2)
    })
  }

  function onImagePointerDown(event) {
    if (!event.target) return

    imageDragHandlers.beginDrag(event, {
      captureEl: event.target,
      suppressClickOnPan: true,
    })
  }

  function onImageClick(event) {
    if (imageDragHandlers.consumePanClick()) return

    if (!isZoomed.value) {
      const imgRect = event.currentTarget?.getBoundingClientRect?.()
      const clickX = event.clientX
      const clickY = event.clientY

      if (!imgRect || imgRect.width === 0 || imgRect.height === 0) {
        toggleZoom()
        return
      }

      const ratioX = Math.min(1, Math.max(0, (clickX - imgRect.left) / imgRect.width))
      const ratioY = Math.min(1, Math.max(0, (clickY - imgRect.top) / imgRect.height))

      void zoomInToPoint(ratioX, ratioY)
    }
  }

  async function zoomInToPoint(ratioX, ratioY) {
    isZoomed.value = true
    imageDragHandlers.onEnd()

    await nextTick()

    if (dialogImageWrap.value === null) {
      return
    }

    requestAnimationFrame(() => {
      if (dialogImageWrap.value === null) {
        return
      }

      const wrap = dialogImageWrap.value
      const targetLeft = wrap.scrollWidth * ratioX - wrap.clientWidth / 2
      const targetTop = wrap.scrollHeight * ratioY - wrap.clientHeight / 2

      wrap.scrollLeft = Math.max(0, targetLeft)
      wrap.scrollTop = Math.max(0, targetTop)
    })
  }

  onMounted(async () => {
    window.addEventListener('popstate', onBrowserPopState)

    if (basePhotos.length === 0) {
      return
    }

    loadProgress.value = 0
    loadedCount.value = 0

    try {
      const total = basePhotos.length
      let done = 0

      const photosWithRatios = await Promise.all(
        basePhotos.map(async (photo) => {
          const ratio = await getImageRatio(photo.thumbSrc)
          done += 1
          loadedCount.value = done
          loadProgress.value = done / total
          return { ...photo, ratio }
        }),
      )

      photos.value = photosWithRatios
    } finally {
      galleryReady.value = true
    }
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', onBrowserPopState)
  })

  watch(dialogOpen, (open) => {
    if (open) {
      return
    }

    if (!previewHistoryPushed.value) {
      return
    }

    previewHistoryPushed.value = false
    ignoreNextPopstate.value = true
    history.back()
    restoreGalleryScroll()
  })

  return {
    googlePhotosUrl,
    basePhotos,
    photos,
    galleryReady,
    loadProgress,
    loadedCount,
    hoveredPhotoSrc,
    thumbExifLines,
    onThumbEnter,
    onThumbLeave,
    dialogOpen,
    dialogSrc,
    dialogLabel,
    exifPanelOpen,
    dialogExifRows,
    isZoomed,
    isDragging,
    dialogImageWrap,
    openPhoto,
    toggleZoom,
    onImagePointerDown,
    onImageClick,
    imageDragHandlers,
  }
}
