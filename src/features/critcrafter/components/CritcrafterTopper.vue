<script setup>
/** Pinned topper: identity and the headline numbers. Slot `extra` sits under them (shield row etc.). */
defineProps({ sheet: { type: Object, required: true } })
</script>

<template>
  <div class="cc-hero q-pa-md q-ma-sm" data-testid="cc-topper">
    <div class="row items-baseline no-wrap">
      <div class="text-h6 col ellipsis">{{ sheet.header.name }}</div>
      <div class="text-caption q-ml-sm">Lv {{ sheet.header.level }}</div>
    </div>
    <div class="text-caption cc-line">
      {{ sheet.header.ancestry }} · {{ sheet.header.classLine }}
    </div>
    <div class="row q-mt-sm text-center">
      <div class="col">
        <div class="text-h5" data-testid="cc-hp">{{ sheet.header.hp.value }}</div>
        <div class="text-caption">HP</div>
      </div>
      <div class="col">
        <div class="text-h5" data-testid="cc-ac">{{ sheet.header.unarmoredAc.value }}</div>
        <div class="text-caption">AC</div>
      </div>
      <div class="col">
        <div class="text-h5">{{ sheet.header.perception.value }}</div>
        <div class="text-caption">Perception</div>
      </div>
      <div class="col">
        <div class="text-h5">{{ sheet.header.speed.value }}</div>
        <div class="text-caption">Speed</div>
      </div>
    </div>
    <slot name="extra" />
  </div>
</template>

<style scoped>
.cc-hero {
  background: var(--q-primary);
  border-radius: 12px;
  flex: none;
}
.cc-line {
  opacity: 0.8;
}
</style>
