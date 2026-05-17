<template>
  <div class="dr-monster-card" :class="{ 'dr-monster-card--idle-empty': empty }">
    <div class="dr-monster-card__scene">
      <div
        ref="flipAxisEl"
        class="dr-monster-card__axis"
        :class="{ 'dr-monster-card__axis--revealed': !empty && !faceDown }"
      >
        <template v-if="empty">
          <div
            class="dr-monster-card__empty-slot"
            :class="{ 'dr-monster-card__empty-slot--hidden': hideEmptySlot }"
            aria-hidden="true"
          />
        </template>
        <template v-else>
        <div class="dr-monster-card__face dr-monster-card__face--back">
          <img class="dr-monster-card__sheet" :src="monsterBackUrl()" alt="" decoding="async" />
        </div>
        <div class="dr-monster-card__face dr-monster-card__face--front">
          <img class="dr-monster-card__sheet" :src="cardBlankUrl()" alt="" decoding="async" />
          <div v-if="spec" class="dr-monster-card__front-art">
            <div class="dr-monster-card__left-rail" :class="{ 'dr-monster-card__left-rail--multi': spec.icons.length > 1 }">
              <div class="dr-monster-card__strength" aria-hidden="true">{{ spec.strength }}</div>
              <div class="dr-monster-card__icons" role="list" aria-label="Defeat symbols">
                <img
                  v-for="ic in spec.icons"
                  :key="ic"
                  :src="symbolUrl(ic)"
                  :alt="ic"
                  class="dr-monster-card__icon"
                  role="listitem"
                />
              </div>
            </div>
            <div class="dr-monster-card__doodle-wrap">
              <img class="dr-monster-card__doodle" :src="monsterDoodleUrl(spec.species)" :alt="displayName" />
            </div>
            <div class="dr-monster-card__name">{{ displayName }}</div>
          </div>
        </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  monsterCardSpecByStrength,
  monsterCardSpecBySpecies,
  displayNameForSpecies,
  cardBlankUrl,
  monsterBackUrl,
  monsterDoodleUrl,
  symbolUrl,
} from '../../features/dungeon-runner/ui/monsterCardSpec.js'

const props = defineProps({
  species: { type: String, default: null },
  strength: { type: Number, default: null },
  faceDown: { type: Boolean, default: false },
  /** Bidding idle: keep layout + flip ref without showing a card back */
  empty: { type: Boolean, default: false },
  hideEmptySlot: { type: Boolean, default: false },
})

const flipAxisEl = ref(null)

defineExpose({
  dungeonCardFlipAxis: flipAxisEl,
})

const spec = computed(() => {
  if (props.empty) return null
  if (props.strength != null && Number.isFinite(props.strength)) {
    return monsterCardSpecByStrength(props.strength)
  }
  if (props.species) {
    return monsterCardSpecBySpecies(props.species)
  }
  return null
})

const displayName = computed(() => displayNameForSpecies(spec.value?.species ?? ''))
</script>

<style scoped>
.dr-monster-card {
  position: relative;
  display: block;
  width: 100%;
  max-width: none;
  margin-inline: 0;
  line-height: 0;
  container-type: inline-size;
}

.dr-monster-card__scene {
  width: 100%;
  aspect-ratio: 384 / 245;
  perspective: 1100px;
  perspective-origin: center center;
  overflow: hidden;
}

.dr-monster-card__axis {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transform-origin: center center;
}

.dr-monster-card__axis--revealed {
  transform: rotateY(180deg);
}

.dr-monster-card__face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.dr-monster-card__face--back {
  transform: rotateY(0deg);
}

.dr-monster-card__face--front {
  transform: rotateY(180deg);
}

.dr-monster-card__sheet {
  width: 100%;
  height: 100%;
  vertical-align: top;
  display: block;
  object-fit: contain;
  object-position: center;
}

.dr-monster-card__front-art {
  position: absolute;
  top: 0.8%;
  right: 0.8%;
  bottom: 0.8%;
  left: 0.8%;
  pointer-events: none;
}

.dr-monster-card__left-rail {
  position: absolute;
  left: 5%;
  top: 4%;
  bottom: 36%;
  width: 17.5%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(4px, 1.2cqw, 10px);
}

.dr-monster-card__left-rail--multi {
  bottom: 42%;
}

.dr-monster-card__left-rail--multi .dr-monster-card__icons {
  transform: translateY(-9%);
  gap: clamp(0px, 0.35cqw, 3px);
}

.dr-monster-card__strength {
  flex-shrink: 0;
  margin-left: 10%;
  font-family: 'Caveat', cursive;
  font-size: clamp(3.75rem, 19cqw, 6.1rem);
  font-weight: 700;
  color: rgba(13, 13, 13, 0.8);
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.28);
}

.dr-monster-card__icons {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: clamp(1px, 0.5cqw, 4px);
  width: 100%;
}

.dr-monster-card__icon {
  width: 100%;
  max-width: 100%;
  height: auto;
  object-fit: contain;
  object-position: left center;
  display: block;
  filter: drop-shadow(0 0 0.5px rgba(255, 255, 255, 0.6));
}

.dr-monster-card__doodle-wrap {
  position: absolute;
  left: 20%;
  right: 6%;
  top: 7%;
  bottom: 26%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dr-monster-card__doodle {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.dr-monster-card__name {
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 9%;
  text-align: center;
  font-family: 'Caveat', cursive;
  font-size: clamp(1.15rem, 6cqw, 1.85rem);
  font-weight: 600;
  color: rgba(13, 13, 13, 0.8);
  line-height: 1.15;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.28);
}

.dr-monster-card--idle-empty .dr-monster-card__scene {
  overflow: visible;
}

.dr-monster-card__empty-slot {
  position: absolute;
  inset: 5%;
  border-radius: 6px;
  border: 2px dashed rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.dr-monster-card__empty-slot--hidden {
  border-color: transparent;
  background: transparent;
}
</style>
