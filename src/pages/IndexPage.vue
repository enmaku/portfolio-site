<template>
  <q-page class="q-pa-md">
    <div v-if="photos.length" class="gallery-masonry">
      <div
        v-for="p in photos"
        :key="p.src"
        class="gallery-tile rounded-borders overflow-hidden"
        @mouseenter="onThumbEnter(p)"
        @mouseleave="onThumbLeave"
      >
        <q-img
          :src="p.src"
          :alt="p.label"
          :ratio="p.ratio"
          class="gallery-thumb cursor-pointer"
          spinner-color="primary"
          fit="cover"
          @click="openPhoto(p)"
        />
        <transition name="exif-slide">
          <div
            v-show="hoveredPhotoSrc === p.src && thumbExifLines.length > 0"
            class="thumb-exif-overlay"
          >
            <div
              v-for="(line, i) in thumbExifLines"
              :key="i"
              class="text-caption text-white ellipsis"
            >
              {{ line }}
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div v-else>
      <q-card class="q-pa-lg" flat bordered>
        <div class="text-h6">No local photos yet</div>
        <div class="text-body2 text-grey q-mt-sm">
          Add images to <code>src/assets/photos/</code> (JPG/PNG/WebP). They will appear in this gallery automatically.
        </div>

        <q-separator class="q-my-md" />

        <div class="row items-center q-col-gutter-md">
          <q-btn
            color="primary"
            icon="photo"
            label="Open Google Photos album"
            :href="googlePhotosUrl"
            target="_blank"
            rel="noreferrer"
            no-caps
          />
        </div>
      </q-card>

      <div class="q-mt-lg">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Preview</div>
            <div class="text-body2 text-grey q-mt-xs">
              If the embed doesn’t load, use the button above.
            </div>
          </q-card-section>

          <q-card-section class="q-pa-none">
            <iframe
              :src="googlePhotosUrl"
              loading="lazy"
              style="width: 100%; height: 70vh; border: 0;"
              referrerpolicy="no-referrer"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="dialogOpen" maximized>
      <q-card class="dialog-card bg-black text-white column no-wrap">
        <q-bar class="dialog-card__bar">
          <q-space />
          <q-btn
            v-if="dialogExifRows.length > 0"
            flat
            dense
            :icon="exifPanelOpen ? 'info' : 'info_outline'"
            aria-label="Toggle photo details"
            @click="exifPanelOpen = !exifPanelOpen"
          />
          <q-btn
            flat
            dense
            :icon="isZoomed ? 'zoom_out' : 'zoom_in'"
            :aria-label="isZoomed ? 'Zoom out to fit' : 'Zoom in'"
            @click="toggleZoom"
          />
          <q-btn flat dense icon="close" aria-label="Close" v-close-popup />
        </q-bar>

        <div class="dialog-card__body">
          <div
            ref="dialogImageWrap"
            class="dialog-image-wrap"
            :class="{ 'dialog-image-wrap--zoomed': isZoomed }"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
            @pointerleave="onDragEnd"
          >
            <img
              :src="dialogSrc"
              :alt="dialogLabel"
              class="dialog-image"
              :class="{
                'dialog-image--zoomed': isZoomed,
                'dialog-image--dragging': isDragging,
              }"
              @pointerdown="onDragStart"
              @click="onImageClick"
              @dragstart.prevent
            />
          </div>

          <div
            v-show="exifPanelOpen && dialogExifRows.length > 0"
            class="dialog-card__exif"
          >
            <q-scroll-area class="exif-scroll">
              <q-list dense dark separator>
                <q-item v-for="(row, idx) in dialogExifRows" :key="idx" class="exif-row">
                  <q-item-section>
                    <q-item-label caption class="text-grey-5">{{ row.label }}</q-item-label>
                    <q-item-label class="text-white text-wrap">{{ row.value }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-scroll-area>
          </div>
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import exifr from 'exifr'
import { nextTick, onMounted, ref } from 'vue'

import { exifSummaryLines, exifToRows } from 'src/utils/exifFormat.js'

const googlePhotosUrl = 'https://photos.app.goo.gl/pjuSWsZbgcp3eC7o6'

const photoModules = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const photos = ref([])

const basePhotos = Object.entries(photoModules)
  .map(([path, src]) => {
    const file = path.split('/').pop() || ''
    const label = file.replace(/\.[^.]+$/, '')
    return { src, label }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

onMounted(async () => {
  const photosWithRatios = await Promise.all(
    basePhotos.map(async (photo) => ({
      ...photo,
      ratio: await getImageRatio(photo.src),
    })),
  )

  photos.value = photosWithRatios
})

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

const exifCache = new Map()

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

const hoveredPhotoSrc = ref('')
const thumbExifLines = ref([])

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

const dialogOpen = ref(false)
const dialogSrc = ref('')
const dialogLabel = ref('')
const exifPanelOpen = ref(true)
const dialogExifRows = ref([])
const isZoomed = ref(false)
const isDragging = ref(false)
const dialogImageWrap = ref(null)

const dragStart = {
  x: 0,
  y: 0,
  scrollLeft: 0,
  scrollTop: 0,
}
const dragMoved = ref(false)

async function openPhoto(photo) {
  dialogSrc.value = photo.src
  dialogLabel.value = photo.label
  isZoomed.value = false
  isDragging.value = false
  dialogExifRows.value = []
  dialogOpen.value = true

  const exif = await loadExif(photo.src)
  dialogExifRows.value = exifToRows(exif)
  exifPanelOpen.value = dialogExifRows.value.length > 0
}

function toggleZoom() {
  const shouldZoomIn = isZoomed.value === false
  isZoomed.value = !isZoomed.value
  isDragging.value = false

  if (shouldZoomIn) {
    void centerZoomedImage()
  }
}

async function centerZoomedImage() {
  await nextTick()

  if (dialogImageWrap.value === null) {
    return
  }

  // Wait one paint so updated zoomed styles affect scroll dimensions.
  requestAnimationFrame(() => {
    if (dialogImageWrap.value === null) {
      return
    }

    const wrap = dialogImageWrap.value
    wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2)
    wrap.scrollTop = Math.max(0, (wrap.scrollHeight - wrap.clientHeight) / 2)
  })
}

function onDragStart(event) {
  if (!isZoomed.value || dialogImageWrap.value === null) {
    return
  }

  isDragging.value = true
  dragMoved.value = false
  dragStart.x = event.clientX
  dragStart.y = event.clientY
  dragStart.scrollLeft = dialogImageWrap.value.scrollLeft
  dragStart.scrollTop = dialogImageWrap.value.scrollTop

  if (event.target && typeof event.target.setPointerCapture === 'function') {
    event.target.setPointerCapture(event.pointerId)
  }
}

function onDragMove(event) {
  if (!isDragging.value || dialogImageWrap.value === null) {
    return
  }

  const deltaX = event.clientX - dragStart.x
  const deltaY = event.clientY - dragStart.y
  const dragThreshold = 4

  if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
    dragMoved.value = true
  }

  dialogImageWrap.value.scrollLeft = dragStart.scrollLeft - deltaX
  dialogImageWrap.value.scrollTop = dragStart.scrollTop - deltaY
}

function onDragEnd() {
  isDragging.value = false
}

function onImageClick(event) {
  // Ignore click events emitted at the end of a drag-pan gesture.
  if (dragMoved.value) {
    dragMoved.value = false
    return
  }

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
  isDragging.value = false

  await nextTick()

  if (dialogImageWrap.value === null) {
    return
  }

  // Wait one paint so updated zoomed styles affect scroll dimensions.
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
</script>

<style scoped>
.gallery-masonry {
  column-count: 1;
  column-gap: 16px;
}

.gallery-tile {
  position: relative;
  break-inside: avoid;
  margin-bottom: 16px;
}

.gallery-thumb {
  width: 100%;
  display: block;
}

.thumb-exif-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.exif-slide-enter-active,
.exif-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.exif-slide-enter-from,
.exif-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.exif-slide-enter-to,
.exif-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.dialog-card {
  width: 100%;
  height: 100%;
  max-height: 100vh;
}

.dialog-card__bar {
  flex-shrink: 0;
  width: 100%;
}

.dialog-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.dialog-card__exif {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 38vh;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.55);
}

.exif-scroll {
  flex: 1;
  min-height: min(32vh, 200px);
  height: min(32vh, 280px);
}

.exif-row {
  padding-top: 8px;
  padding-bottom: 8px;
}

@media (min-width: 768px) {
  .dialog-card__body {
    flex-direction: row;
    align-items: stretch;
  }

  .dialog-card__exif {
    flex: 0 0 300px;
    width: 300px;
    max-height: none;
    border-top: none;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    min-height: 0;
  }

  .exif-scroll {
    flex: 1;
    height: 0;
    min-height: 0;
    max-height: none;
  }
}

.dialog-image-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: auto;
}

.dialog-image-wrap--zoomed {
  align-items: flex-start;
  justify-content: flex-start;
}

.dialog-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: zoom-in;
}

.dialog-image--zoomed {
  max-width: none;
  max-height: none;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
}

.dialog-image--dragging {
  cursor: grabbing;
}

@media (min-width: 600px) {
  .gallery-masonry {
    column-count: 2;
  }
}

@media (min-width: 1024px) {
  .gallery-masonry {
    column-count: 3;
  }
}

@media (min-width: 1440px) {
  .gallery-masonry {
    column-count: 4;
  }
}
</style>
