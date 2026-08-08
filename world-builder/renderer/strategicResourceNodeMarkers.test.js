import assert from 'node:assert/strict'
import test from 'node:test'
import {
  drawMineralDepositIcon,
  drawSaltDepositIcon,
  MINERAL_DIAMOND_PATH_D,
  MINERAL_INGOT_PATH_D,
  SALT_NODE_OVERLAY_COLOR,
  SALT_SHAKER_PATH_D,
} from './strategicResourceNodeMarkers.js'
import { mineralNodeOverlayColor } from './worldBuilderMapViewportModel.js'
import { MINERAL_KINDS } from '../core/resources/mineralOccurrence.js'

class FakeGraphicsPath {
  /**
   * @param {string} d
   */
  constructor(d) {
    this.d = d
  }
}

function fakeGraphics() {
  /** @type {string[]} */
  const pathDs = []
  /** @type {number[]} */
  const fillColors = []
  return {
    pathDs,
    fillColors,
    save() {},
    restore() {},
    setTransform() {},
    /**
     * @param {FakeGraphicsPath} path
     */
    path(path) {
      pathDs.push(path.d)
    },
    stroke() {},
    /**
     * @param {{ color?: number }} [style]
     */
    fill({ color } = {}) {
      if (typeof color === 'number') {
        fillColors.push(color)
      }
    },
  }
}

test('drawMineralDepositIcon uses ingot path for copper silver and gold', () => {
  for (const kind of ['copper', 'silver', 'gold']) {
    const graphics = fakeGraphics()
    drawMineralDepositIcon(
      /** @type {any} */ (graphics),
      10,
      20,
      /** @type {any} */ (kind),
      /** @type {any} */ (FakeGraphicsPath),
    )
    assert.ok(graphics.pathDs.includes(MINERAL_INGOT_PATH_D))
    assert.ok(graphics.fillColors.includes(mineralNodeOverlayColor(/** @type {any} */ (kind))))
  }
})

test('drawMineralDepositIcon uses diamond path for diamond deposits', () => {
  const graphics = fakeGraphics()
  drawMineralDepositIcon(
    /** @type {any} */ (graphics),
    0,
    0,
    'diamond',
    /** @type {any} */ (FakeGraphicsPath),
  )
  assert.ok(graphics.pathDs.includes(MINERAL_DIAMOND_PATH_D))
  assert.ok(graphics.fillColors.includes(mineralNodeOverlayColor('diamond')))
})

test('every mineral kind gets a distinct stamp fill matching overlay colors', () => {
  const fills = MINERAL_KINDS.map((kind) => {
    const graphics = fakeGraphics()
    drawMineralDepositIcon(
      /** @type {any} */ (graphics),
      0,
      0,
      kind,
      /** @type {any} */ (FakeGraphicsPath),
    )
    return graphics.fillColors[0]
  })
  assert.strictEqual(new Set(fills).size, MINERAL_KINDS.length)
})

test('drawSaltDepositIcon stamps the salt-shaker path', () => {
  const graphics = fakeGraphics()
  drawSaltDepositIcon(
    /** @type {any} */ (graphics),
    1,
    2,
    /** @type {any} */ (FakeGraphicsPath),
  )
  assert.ok(graphics.pathDs.includes(SALT_SHAKER_PATH_D))
  assert.ok(graphics.fillColors.includes(SALT_NODE_OVERLAY_COLOR))
})
