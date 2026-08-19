import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import {
  createAccountWithEmailPassword,
  isAccountOwnerUser,
  isTimeTrackerFirebaseConfigured,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signOutTimeTracker,
  subscribeTimeTrackerAuthState,
} from '../firebase/auth.js'

export function useTimeTrackerAuth() {
  const user = shallowRef(null)
  const loading = ref(true)
  const isAccountOwner = computed(() => isAccountOwnerUser(user.value))
  const isConfigured = computed(() => isTimeTrackerFirebaseConfigured())

  const unsubscribe = subscribeTimeTrackerAuthState((nextUser) => {
    user.value = nextUser
    loading.value = false
  })

  onScopeDispose(unsubscribe)

  return {
    user,
    isAccountOwner,
    loading,
    isConfigured,
    signInWithGoogle: signInWithGooglePopup,
    createAccountWithEmailPassword,
    signInWithEmailPassword,
    signOut: signOutTimeTracker,
  }
}
