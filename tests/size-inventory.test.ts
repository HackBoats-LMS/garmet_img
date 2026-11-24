import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSizeInventory,
  sumSizeInventory,
  findSizeByStockCode,
} from '../lib/size-inventory';

describe('Size Inventory Engine', () => {
  test('normalizes legacy number format correctly', () => {
    const raw = { s: 3, M: 5, '  xl ': 2 };
    const normalized = normalizeSizeInventory(raw);

    assert.equal(normalized['S'].quantity, 3);
    assert.equal(normalized['M'].quantity, 5);
    assert.equal(normalized['XL'].quantity, 2);
  });

  test('normalizes JSON string input safely', () => {
    const rawJson = JSON.stringify({ XXL: { quantity: 4, stockCode: 'BARCODE-99' } });
    const normalized = normalizeSizeInventory(rawJson);

    assert.equal(normalized['XXL'].quantity, 4);
    assert.equal(normalized['XXL'].stockCode, 'BARCODE-99');
  });

  test('guards against negative quantities, empty sizes, and malformed inputs', () => {
    const raw = {
      '': 10,
      '   ': 5,
      XS: -4,
      FREE: 'invalid_number',
    };
    const normalized = normalizeSizeInventory(raw);

    assert.equal(normalized[''], undefined);
    assert.equal(normalized['XS'].quantity, 0);
    assert.equal(normalized['FREE'], undefined);
    assert.deepEqual(normalizeSizeInventory(null), {});
    assert.deepEqual(normalizeSizeInventory([]), {});
  });

  test('computes total aggregate quantity across all sizes', () => {
    const inv = {
      S: 2,
      M: { quantity: 10 },
      L: { quantity: '3' },
      XL: 0,
    };
    assert.equal(sumSizeInventory(inv), 15);
  });

  test('finds exact matching size variant by barcode or stockCode', () => {
    const inv = {
      S: { quantity: 2, stockCode: 'SKU-001-S' },
      M: { quantity: 5, stockCodes: ['SKU-001-M1', 'SKU-001-M2'] },
      L: { quantity: 1, stockCode: 'SKU-001-L' },
    };

    const matchM = findSizeByStockCode(inv, 'sku-001-m2');
    assert.ok(matchM);
    assert.equal(matchM.size, 'M');
    assert.equal(matchM.item.quantity, 5);

    const matchS = findSizeByStockCode(inv, 'SKU-001-S');
    assert.ok(matchS);
    assert.equal(matchS.size, 'S');

    assert.equal(findSizeByStockCode(inv, 'NON-EXISTENT'), null);
  });
});
