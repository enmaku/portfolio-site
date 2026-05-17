let flipPluginRegistered = false

/** Loads GSAP + Flip; registers Flip once per realm. `options.import` overrides `import()` for tests. */
export async function loadPresentationGsap(options = {}) {
  let gsapModule
  let flipModule
  if (typeof options.import === 'function') {
    const importFn = options.import
    ;[gsapModule, flipModule] = await Promise.all([importFn('gsap'), importFn('gsap/Flip')])
  } else {
    ;[gsapModule, flipModule] = await Promise.all([import('gsap'), import('gsap/Flip')])
  }
  const gsap = gsapModule.default
  const Flip = flipModule.Flip
  if (!flipPluginRegistered) {
    gsap.registerPlugin(Flip)
    flipPluginRegistered = true
  }
  return { gsap, Flip }
}
