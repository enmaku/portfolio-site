<template>
  <div class="dr-monster-card">
    <img
      class="dr-monster-card__sheet"
      :src="faceDown ? monsterBackUrl() : cardBlankUrl()"
      alt=""
      decoding="async"
    />
    <div v-if="!faceDown && spec" class="dr-monster-card__face">
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

<script setup>
import { computed } from 'vue'
import {
  MONSTER_CARD_SPECS,
  monsterCardSpecByStrength,
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
})

const spec = computed(() => {
  if (props.strength != null && Number.isFinite(props.strength)) {
    return monsterCardSpecByStrength(props.strength)
  }
  if (props.species) {
    return MONSTER_CARD_SPECS.find((s) => s.species === props.species) ?? null
  }
  return null
})

const displayName = computed(() => displayNameForSpecies(spec.value?.species ?? ''))
</script>

<style scoped>
/* Base sheet sets intrinsic size; overlays use the same box so % line up with ink (not letterboxed CSS background). */
.dr-monster-card {
  position: relative;
  display: block;
  width: 100%;
  max-width: 480px;
  margin-inline: auto;
  line-height: 0;
  container-type: inline-size;
}

.dr-monster-card__sheet {
  width: 100%;
  height: auto;
  vertical-align: top;
  display: block;
}

/* Inset matches opaque bbox of `card-blank.png` (transparent margins ~10.4% ×, ~5.1% top, ~6.3% bottom @ 480×272). */
.dr-monster-card__face {
  position: absolute;
  top: 5.15%;
  right: 10.42%;
  bottom: 6.25%;
  left: 10.42%;
  pointer-events: none;
}

.dr-monster-card__left-rail {
  position: absolute;
  left: 0;
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
  margin-left: 2.5%;
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
  left: 18%;
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
</style>
