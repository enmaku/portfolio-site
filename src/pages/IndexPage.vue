<template>
  <q-page class="q-pa-md">
    <div
      v-if="basePhotos.length > 0 && !gallery.ready"
      class="gallery-loading column items-center justify-center q-gutter-y-md"
    >
      <div class="text-body1 text-grey-8">Loading gallery…</div>
      <q-linear-progress
        :value="gallery.loadProgress"
        color="primary"
        class="gallery-loading__bar rounded-borders"
        size="10px"
        instant-feedback
      />
      <div class="text-caption text-grey-6">
        {{ gallery.loadedCount }} / {{ basePhotos.length }} images
      </div>
    </div>

    <div v-else-if="gallery.photos.length > 0" class="gallery-masonry">
      <div
        v-for="p in gallery.photos"
        :key="p.src"
        class="gallery-tile rounded-borders overflow-hidden"
        @mouseenter="gallery.onThumbEnter(p)"
        @mouseleave="gallery.onThumbLeave"
      >
        <q-img
          :src="p.thumbSrc"
          :alt="p.label"
          :ratio="p.ratio"
          loading="eager"
          class="gallery-thumb cursor-pointer"
          spinner-color="primary"
          fit="cover"
          @click="preview.openPhoto(p)"
        />
        <transition name="exif-slide">
          <div
            v-show="gallery.hoveredPhotoSrc === p.src && gallery.thumbExifLines.length > 0"
            class="thumb-exif-overlay"
          >
            <div
              v-for="(line, i) in gallery.thumbExifLines"
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

    <q-dialog
      v-model="preview.open"
      maximized
      transition-show="scale"
      transition-hide="scale"
      :transition-duration="300"
    >
      <q-card class="dialog-card bg-black text-white column no-wrap">
        <q-bar class="dialog-card__bar">
          <q-space />
          <q-btn
            v-if="preview.exifRows.length > 0"
            flat
            dense
            :icon="preview.exifPanelOpen ? 'info' : 'info_outline'"
            aria-label="Toggle photo details"
            @click="preview.exifPanelOpen = !preview.exifPanelOpen"
          />
          <q-btn
            flat
            dense
            :icon="preview.isZoomed ? 'zoom_out' : 'zoom_in'"
            :aria-label="preview.isZoomed ? 'Zoom out to fit' : 'Zoom in'"
            @click="preview.toggleZoom"
          />
          <q-btn flat dense icon="close" aria-label="Close" v-close-popup />
        </q-bar>

        <div class="dialog-card__body">
          <div
            :ref="(el) => { preview.imageWrap = el }"
            class="dialog-image-wrap"
            :class="{ 'dialog-image-wrap--zoomed': preview.isZoomed }"
            @pointermove="preview.onImageWrapPointerMove"
            @pointerup="preview.onImageWrapPointerEnd"
            @pointercancel="preview.onImageWrapPointerEnd"
            @pointerleave="preview.onImageWrapPointerEnd"
          >
            <img
              :src="preview.src"
              :alt="preview.label"
              class="dialog-image"
              :class="{
                'dialog-image--zoomed': preview.isZoomed,
                'dialog-image--dragging': preview.isDragging,
              }"
              @pointerdown="preview.onImagePointerDown"
              @click="preview.onImageClick"
              @dragstart.prevent
            />
          </div>

          <div
            v-show="preview.exifPanelOpen && preview.exifRows.length > 0"
            class="dialog-card__exif"
          >
            <q-scroll-area class="exif-scroll">
              <q-list dense dark separator>
                <q-item v-for="(row, idx) in preview.exifRows" :key="idx" class="exif-row">
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
import { usePhotoGallery } from 'src/composables/usePhotoGallery.js'

const { googlePhotosUrl, basePhotos, gallery, preview } = usePhotoGallery()
</script>

<style scoped>
.gallery-loading {
  width: 100%;
  min-height: 40vh;
  padding: 24px 0;
}

.gallery-loading__bar {
  width: 100%;
  max-width: 420px;
}

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
