import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createCatalogProvider, DEFAULT_READY_HEIGHT_CM, computeFabricConstraints } from '../src/catalog';
import type { CurtainConfig } from '../src/catalog';
import { mockCatalog } from '../src/catalog/mock/data';

const provider = createCatalogProvider('mock');

describe('MockCatalogProvider', () => {
  it('returns default curtain with valid dimensions', async () => {
    const curtain = await provider.getDefaultCurtain();
    assert.ok(curtain.fabricId, 'fabricId should be set');
    assert.ok(curtain.pleatId, 'pleatId should be set');
    assert.ok(curtain.hemId, 'hemId should be set');
    assert.ok(curtain.widthCm > 0, 'width should be positive');
    assert.equal(curtain.heightCm, DEFAULT_READY_HEIGHT_CM);
  });

  it('filters fabrics and pleats based on compatibility and price range', async () => {
    const types = await provider.listFabricTypes({ priceRangeMinor: { min: 5000, max: 6000 } });
    assert.ok(types.some((t) => t.id === 'sheer-thin'));
    assert.ok(!types.some((t) => t.id === 'drape-thick'), 'drape thick should be filtered out of narrow range');

    const fabrics = await provider.listFabrics({ fabricTypeId: 'sheer-thin', priceRangeMinor: { min: 5000, max: 6000 } });
    assert.equal(fabrics.length, 1);
    assert.equal(fabrics[0].id, 'fab-plain-sheer-150');

    const pleats = await provider.listPleats({ fabricId: 'fab-plain-sheer-150' });
    assert.deepEqual(
      pleats.map((p) => p.id).sort(),
      ['tape', 'wave']
    );

    const hems = await provider.listHems({ fabricId: 'fab-plain-sheer-150', pleatId: 'wave' });
    assert.deepEqual(hems.map((h) => h.id), ['hem-1cm']);
  });

  it('calculates deterministic pricing with services', async () => {
    const config: CurtainConfig = {
      fabricId: 'fab-linen-300',
      pleatId: 'wave',
      hemId: 'hem-10cm',
      widthCm: 250,
      heightCm: 260,
      segments: 2,
      services: ['svc-measure', 'svc-rod-basic'],
    };

    const quote = await provider.priceQuote(config);
    assert.equal(quote.currency, 'PLN');
    assert.equal(quote.subtotalMinor, 42670);
    assert.equal(quote.servicesMinor, 24800);
    assert.equal(quote.totalMinor, 67470);
    assert.equal(quote.breakdown.at(-1)?.type, 'total');

    const meta = quote.providerMetadata as Record<string, any> | undefined;
    assert.ok(meta);
    assert.equal(meta?.totalLinearCm, 570);
    assert.equal(meta?.numWidths, 2);
    assert.equal(meta?.fullness, 2.2);
    assert.equal(meta?.appliedWidthCm, 250);
    assert.equal(meta?.appliedHeightCm, 260);

    const fabricLine = quote.breakdown.find((item) => item.id === 'fabric');
    const fabricMeta = fabricLine?.providerMetadata as Record<string, any> | undefined;
    assert.ok(fabricMeta);
    assert.equal(fabricMeta?.cutDropCm, 280);
    assert.equal(fabricMeta?.allowancesCm?.top, 10);
    assert.equal(fabricMeta?.allowancesCm?.bottom, 10);
    assert.equal(fabricMeta?.shrinkagePct, 2);
  });

  it('builds cart payload including selected services', async () => {
    const config: CurtainConfig = {
      fabricId: 'fab-linen-300',
      pleatId: 'wave',
      hemId: 'hem-10cm',
      widthCm: 250,
      heightCm: 260,
      segments: 2,
      services: ['svc-measure', 'svc-rod-basic'],
    };

    const cart = await provider.toCartPayload(config);
    assert.equal(cart.sku, 'CW-FAB-LINEN-300');
    assert.equal(cart.quantity, 2);
    assert.ok(cart.options);
    const options = cart.options as Record<string, any>;
    assert.equal(options.pleatId, 'wave');
    assert.ok(Array.isArray(cart.services));
    assert.deepEqual(
      cart.services?.map((svc) => svc.sku).sort(),
      ['CW-HW-ROD-BASIC', 'CW-SVC-MEASURE']
    );
  });

  it('derives fabric constraints from catalog data', () => {
    const sheer = mockCatalog.fabrics.find((f) => f.id === 'fab-plain-sheer-150');
    const doubleWidth = mockCatalog.fabrics.find((f) => f.id === 'fab-linen-300');
    assert.ok(sheer);
    assert.ok(doubleWidth);

    const sheerConstraints = computeFabricConstraints(sheer);
    assert.equal(sheerConstraints.maxPanelWidthCm, 150);
    assert.equal(sheerConstraints.maxCurtainHeightCm, null);

    const doubleConstraints = computeFabricConstraints(doubleWidth);
    assert.equal(doubleConstraints.maxPanelWidthCm, null);
    assert.equal(doubleConstraints.maxCurtainHeightCm, 280);
  });

  it('clamps oversize width and height while surfacing metadata', async () => {
    const oversizeConfig: CurtainConfig = {
      fabricId: 'fab-plain-sheer-150',
      pleatId: 'wave',
      hemId: 'hem-1cm',
      widthCm: 420,
      heightCm: 270,
      segments: 2,
      services: [],
    };

    const quote = await provider.priceQuote(oversizeConfig);
    const meta = quote.providerMetadata as Record<string, any> | undefined;
    assert.ok(meta);
    assert.equal(meta?.appliedPanelWidthCm, 150);
    assert.equal(meta?.appliedWidthCm, 300);
    assert.strictEqual(meta?.constraintsHit?.width, true);
    assert.strictEqual(meta?.constraintsHit?.height, false);

    const cart = await provider.toCartPayload(oversizeConfig);
    const cartOptions = cart.options as Record<string, any>;
    assert.equal(cartOptions.appliedPanelWidthCm, 150);
    assert.equal(cartOptions.appliedWidthCm, 300);
    assert.strictEqual(cartOptions.constraintsHit?.width, true);
    assert.strictEqual(cartOptions.constraintsHit?.height, false);
  });

  it('clamps double-width curtain height to usable fabric', async () => {
    const tallConfig: CurtainConfig = {
      fabricId: 'fab-linen-300',
      pleatId: 'wave',
      hemId: 'hem-10cm',
      widthCm: 250,
      heightCm: 300,
      segments: 2,
      services: [],
    };

    const quote = await provider.priceQuote(tallConfig);
    const meta = quote.providerMetadata as Record<string, any> | undefined;
    assert.ok(meta);
    assert.equal(meta?.appliedHeightCm, 280);
    assert.strictEqual(meta?.constraintsHit?.height, true);

    const cart = await provider.toCartPayload(tallConfig);
    const tallOptions = cart.options as Record<string, any>;
    assert.equal(tallOptions.appliedHeightCm, 280);
    assert.strictEqual(tallOptions.constraintsHit?.height, true);
  });

  it('rejects with a clear error when the fabric id is unknown', async () => {
    const config: CurtainConfig = {
      fabricId: 'does-not-exist',
      pleatId: 'wave',
      hemId: 'hem-1cm',
      widthCm: 200,
      heightCm: 240,
      segments: 2,
      services: [],
    };

    await assert.rejects(() => provider.priceQuote(config), /Fabric does-not-exist not found/);
  });
});
