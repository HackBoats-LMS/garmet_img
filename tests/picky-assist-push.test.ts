import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCatalogueTitleAndDescription,
  extractProductImages,
} from '../lib/picky-assist-push';

describe('Picky Assist Push & Formatting Utilities', () => {
  test('parses pipe-separated title and price description correctly', () => {
    const input = 'Midnight Blue Silk Saree | ₹2499. Handwoven with gold zari motifs for festive elegance.';
    const parsed = parseCatalogueTitleAndDescription(input);

    assert.equal(parsed.title, 'Midnight Blue Silk Saree');
    assert.equal(parsed.description, 'Handwoven with gold zari motifs for festive elegance.');
  });

  test('parses dash-separated title and description', () => {
    const input = 'Coral Bloom — Lightweight organza saree with delicate floral embroidery';
    const parsed = parseCatalogueTitleAndDescription(input);

    assert.equal(parsed.title, 'Coral Bloom');
    assert.equal(parsed.description, 'Lightweight organza saree with delicate floral embroidery');
  });

  test('handles plain description with fallback title safely', () => {
    const input = 'Everyday breathable cotton kurti set with round neck.';
    const parsed = parseCatalogueTitleAndDescription(input, 'Default Kurti');

    assert.equal(parsed.title, 'Default Kurti');
    assert.equal(parsed.description, 'Everyday breathable cotton kurti set with round neck.');
  });

  test('extracts up to 5 product images in priority order', () => {
    const product = {
      coverImageUrl: 'https://cdn.example.com/cover.jpg',
      generatedImages: {
        pose2: { imageUrl: 'https://cdn.example.com/pose2.jpg', order: 2 },
        pose1: { imageUrl: 'https://cdn.example.com/pose1.jpg', order: 1 },
      },
      referenceImages: [
        'https://cdn.example.com/swatch1.jpg',
        { url: 'https://cdn.example.com/swatch2.jpg' },
        'https://cdn.example.com/swatch3.jpg',
      ],
    };

    const extracted = extractProductImages(product);
    assert.equal(extracted.length, 5);
    assert.equal(extracted[0], 'https://cdn.example.com/cover.jpg');
    assert.equal(extracted[1], 'https://cdn.example.com/pose1.jpg');
    assert.equal(extracted[2], 'https://cdn.example.com/pose2.jpg');
    assert.ok(extracted.includes('https://cdn.example.com/swatch1.jpg'));
  });
});
