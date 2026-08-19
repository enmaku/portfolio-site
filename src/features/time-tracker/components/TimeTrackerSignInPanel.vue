<template>
  <q-card flat bordered class="tt-sign-in-panel">
    <q-card-section v-if="loading" class="column items-center q-py-xl" data-testid="tt-auth-loading">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </q-card-section>

    <q-card-section v-else-if="!isConfigured" data-testid="tt-auth-unconfigured">
      <q-banner rounded class="bg-grey-9 text-grey-4">
        Time Tracker sign-in is unavailable until Firebase is configured in this environment.
      </q-banner>
    </q-card-section>

    <template v-else>
      <q-card-section data-testid="tt-auth-sign-in-form">
        <div class="text-h6 text-weight-medium q-mb-xs">Sign in</div>
        <div class="text-body2 text-grey-5 q-mb-lg">
          Use Google or email to access your projects, time entries, and invoices.
        </div>

        <q-banner v-if="errorMessage" rounded class="bg-negative text-white q-mb-md" data-testid="tt-auth-error">
          {{ errorMessage }}
        </q-banner>

        <div class="column q-gutter-y-md">
          <q-btn
            outline
            no-caps
            color="grey-5"
            class="full-width tt-sign-in-panel__google-btn"
            icon="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            label="Continue with Google"
            data-testid="tt-auth-google-btn"
            :loading="actionPending"
            @click="onGoogleSignIn"
          />

          <q-separator class="q-my-xs" />

          <form class="column q-gutter-y-md" @submit.prevent="onEmailSignIn">
            <q-input
              v-model="email"
              type="email"
              label="Email"
              outlined
              dense
              autocomplete="email"
              data-testid="tt-auth-email-input"
              :disable="actionPending"
            />
            <q-input
              v-model="password"
              type="password"
              label="Password"
              outlined
              dense
              autocomplete="current-password"
              data-testid="tt-auth-password-input"
              :disable="actionPending"
            />
            <q-btn
              type="submit"
              unelevated
              no-caps
              color="primary"
              class="full-width"
              label="Sign in with email"
              data-testid="tt-auth-sign-in-btn"
              :loading="actionPending"
              :disable="!canSubmitEmail"
            />
            <q-btn
              type="button"
              flat
              no-caps
              color="grey-5"
              class="full-width"
              label="Create account"
              data-testid="tt-auth-create-account-btn"
              :loading="actionPending"
              :disable="!canSubmitEmail"
              @click="onCreateAccount"
            />
          </form>
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useTimeTrackerAuth } from '../composables/useTimeTrackerAuth.js'

const {
  loading,
  isConfigured,
  signInWithGoogle,
  createAccountWithEmailPassword,
  signInWithEmailPassword,
} = useTimeTrackerAuth()

const email = ref('')
const password = ref('')
const actionPending = ref(false)
const errorMessage = ref('')
const canSubmitEmail = computed(() => email.value.trim().length > 0 && password.value.length > 0)

/**
 * @param {() => Promise<unknown>} action
 */
async function runAuthAction(action) {
  errorMessage.value = ''
  actionPending.value = true
  try {
    await action()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Sign-in failed.'
  } finally {
    actionPending.value = false
  }
}

function onGoogleSignIn() {
  return runAuthAction(() => signInWithGoogle())
}

function onEmailSignIn() {
  if (!canSubmitEmail.value) return
  return runAuthAction(() => signInWithEmailPassword(email.value.trim(), password.value))
}

function onCreateAccount() {
  if (!canSubmitEmail.value) return
  return runAuthAction(() => createAccountWithEmailPassword(email.value.trim(), password.value))
}
</script>

<style scoped>
.tt-sign-in-panel {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
  max-width: 28rem;
}

.tt-sign-in-panel__google-btn :deep(.q-icon) {
  width: 1.125rem;
  height: 1.125rem;
}
</style>
