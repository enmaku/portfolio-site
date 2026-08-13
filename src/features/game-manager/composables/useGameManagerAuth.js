import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import {
  createAccountWithEmailPassword,
  isAccountOwnerUser,
  isGameManagerFirebaseConfigured,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signOutGameManager,
  subscribeGameManagerAuthState,
} from '../firebase/auth.js'

/**
 * @returns {{
 *   user: import('vue').ShallowRef<import('firebase/auth').User | null>,
 *   isAccountOwner: import('vue').ComputedRef<boolean>,
 *   loading: import('vue').Ref<boolean>,
 *   isConfigured: import('vue').ComputedRef<boolean>,
 *   signInWithGoogle: typeof signInWithGooglePopup,
 *   createAccountWithEmailPassword: typeof createAccountWithEmailPassword,
 *   signInWithEmailPassword: typeof signInWithEmailPassword,
 *   signOut: typeof signOutGameManager,
 * }}
 */
export function useGameManagerAuth() {
  const user = shallowRef(null)
  const loading = ref(true)

  const isAccountOwner = computed(() => isAccountOwnerUser(user.value))
  const isConfigured = computed(() => isGameManagerFirebaseConfigured())

  const unsubscribe = subscribeGameManagerAuthState((nextUser) => {
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
    signOut: signOutGameManager,
  }
}
