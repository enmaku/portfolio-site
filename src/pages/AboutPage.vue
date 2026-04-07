<template>
  <q-page class="q-pa-md row justify-center">
    <q-card class="about-card q-pa-lg" flat bordered style="width: min(920px, 100%);">
      <q-card-section class="q-pb-none">
        <div class="text-h4 text-weight-light">{{ resume.name }}</div>
        <div class="text-subtitle1 text-grey-5 q-mt-xs">
          {{ resume.tagline }}
        </div>
        <div class="row items-center q-gutter-x-md q-mt-md text-body2">
          <a class="text-primary text-decoration-none" :href="`tel:${resume.contact.phoneTel}`" target="_blank">
            {{ resume.contact.phoneDisplay }}
          </a>
          <span class="text-grey-7">·</span>
          <a class="text-primary text-decoration-none" :href="`mailto:${resume.contact.email}`" target="_blank">
            {{ resume.contact.email }}
          </a>
        </div>
      </q-card-section>

      <q-separator class="q-my-lg" />

      <q-card-section class="q-pt-none">
        <div class="text-overline text-grey-6 q-mb-sm">Professional summary</div>
        <p class="text-body1 q-mb-none" style="line-height: 1.65">
          {{ resume.summary }}
        </p>
      </q-card-section>

      <q-separator class="q-my-md" />

      <q-card-section class="q-pt-none">
        <div class="text-overline text-grey-6 q-mb-md">Skills</div>
        <div v-for="group in resume.skillGroups" :key="group.label" class="q-mb-md">
          <div class="text-caption text-grey-6 text-uppercase q-mb-xs" style="letter-spacing: 0.06em">
            {{ group.label }}
          </div>
          <div class="row q-col-gutter-xs">
            <div v-for="item in group.items" :key="item" class="col-auto">
              <q-chip dense outline color="grey-5" text-color="grey-3">
                {{ item }}
              </q-chip>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-separator class="q-my-md" />

      <q-card-section class="q-pt-none">
        <div class="text-overline text-grey-6 q-mb-lg">Professional experience</div>

        <div v-for="(job, index) in resume.positions" :key="`${job.company}-${job.dates}`" class="q-mb-xl">
          <div class="row items-start justify-between q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-medium">{{ job.company }}</div>
            </div>
            <div class="col-auto text-right text-body2 text-grey-5" style="white-space: nowrap">
              {{ job.dates }}
            </div>
          </div>
          <div class="text-body2 text-primary q-mt-xs">{{ job.title }}</div>

          <ul
            v-if="job.bullets && job.bullets.length"
            class="about-bullets q-mt-sm q-mb-none text-body2 text-grey-4"
          >
            <li v-for="(bullet, i) in job.bullets" :key="i">{{ bullet }}</li>
          </ul>

          <q-separator v-if="index < resume.positions.length - 1" class="q-mt-xl" />
        </div>
      </q-card-section>

      <q-separator class="q-my-md" />

      <q-card-section class="q-pt-none">
        <div class="text-overline text-grey-6 q-mb-sm">Education</div>
        <div class="text-body1 text-weight-medium">
          {{ resume.education.degree }}
        </div>
        <div class="text-body2 text-grey-5 q-mt-xs">{{ resume.education.dates }}</div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import resume from '../data/resume.json'
</script>

<style scoped>
.about-card {
  border-radius: 4px;
}

.about-bullets {
  padding-left: 1.25rem;
  line-height: 1.6;
}

.about-bullets li + li {
  margin-top: 0.35rem;
}

.text-decoration-none {
  text-decoration: none;
}
</style>
