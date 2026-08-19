export {
  isAccountOwnerUser,
  signInWithGooglePopup,
  createAccountWithEmailPassword,
  signInWithEmailPassword,
  isPortfolioFirebaseConfigured as isGameManagerFirebaseConfigured,
  getPortfolioAuth as getGameManagerAuth,
  subscribeAccountOwnerAuthState as subscribeGameManagerAuthState,
  signOutAccountOwner as signOutGameManager,
} from '../../account-owner/firebase/auth.js'
