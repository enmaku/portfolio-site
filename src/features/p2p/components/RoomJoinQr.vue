<template>
  <div v-if="dataUrl" class="room-join-qr column items-center no-wrap">
    <img
      class="room-join-qr__image"
      :src="dataUrl"
      :alt="altText"
      decoding="async"
      loading="lazy"
    />
    <span class="room-join-qr__caption text-body2">Scan to join</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildRoomJoinQrDataUrl } from '../roomJoinQr.js'

const props = defineProps({
  /** Absolute **join link** to encode. Empty renders nothing. */
  url: { type: String, default: '' },
  /** Room code, used only for the image alt text. */
  roomCode: { type: String, default: '' },
})

const dataUrl = computed(() => buildRoomJoinQrDataUrl(props.url))

const altText = computed(() =>
  props.roomCode ? `QR code to join room ${props.roomCode}` : 'QR code to join room',
)
</script>

<style scoped lang="scss">
.room-join-qr {
  gap: 8px;
  width: 100%;
}

/* Scanners need dark modules on a light field — never invert for the dark theme. */
.room-join-qr__image {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  border-radius: 8px;
  background: #ffffff;
}

.room-join-qr__caption {
  color: #9e9e9e;
}
</style>
