<template>
  <q-page class="q-pa-md">
    <div v-if="photos.length" class="gallery-masonry">
      <div
        v-for="p in photos"
        :key="p.src"
        class="gallery-tile"
      >
        <q-img
          :src="p.src"
          :alt="p.label"
          class="gallery-thumb rounded-borders cursor-pointer"
          spinner-color="primary"
          fit="cover"
          @click="openPhoto(p)"
        />
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
      <q-card class="bg-black text-white column no-wrap">
        <q-bar>
          <q-space />
          <q-btn
            flat
            dense
            :icon="isZoomed ? 'zoom_out' : 'zoom_in'"
            :aria-label="isZoomed ? 'Zoom out to fit' : 'Zoom in'"
            @click="toggleZoom"
          />
          <q-btn flat dense icon="close" aria-label="Close" v-close-popup />
        </q-bar>
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
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

const googlePhotosUrl = 'https://photos.app.goo.gl/pjuSWsZbgcp3eC7o6'

// Vite will build these images into your bundle.
// Add your photos to `src/assets/photos/` and they will show up here.
const photoModules = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const photos = computed(() => {
  return Object.entries(photoModules)
    .map(([path, src]) => {
      const file = path.split('/').pop() || ''
      const label = file.replace(/\.[^.]+$/, '')
      return { src, label }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
})

const dialogOpen = ref(false)
const dialogSrc = ref('')
const dialogLabel = ref('')
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

function openPhoto(photo) {
  dialogSrc.value = photo.src
  dialogLabel.value = photo.label
  isZoomed.value = false
  isDragging.value = false
  dialogOpen.value = true
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
  break-inside: avoid;
  margin-bottom: 16px;
}

.gallery-thumb {
  width: 100%;
  display: block;
}

.dialog-image-wrap {
  flex: 1;
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
