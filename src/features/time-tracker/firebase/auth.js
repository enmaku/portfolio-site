export {
  isAccountOwnerUser,
  signInWithGooglePopup,
  createAccountWithEmailPassword,
  signInWithEmailPassword,
  isPortfolioFirebaseConfigured as isTimeTrackerFirebaseConfigured,
  getPortfolioAuth as getTimeTrackerAuth,
  subscribeAccountOwnerAuthState as subscribeTimeTrackerAuthState,
  signOutAccountOwner as signOutTimeTracker,
} from '../../account-owner/firebase/auth.js'
