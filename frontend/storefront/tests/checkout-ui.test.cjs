const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const payment = fs.readFileSync(path.join(__dirname, '../src/features/checkout/components/PaymentMethods.tsx'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '../src/app/checkout/page.tsx'), 'utf8');

test('payment UI keeps ineligible COD disabled with a reason', () => {
  assert.match(payment, /method === 'COD' && !enabled/);
  assert.match(payment, /Unavailable for this order or pincode/);
});
test('payment UI exposes coupon apply/remove and wallet toggle controls', () => {
  assert.match(payment, /Enter code/);
  assert.match(payment, /Code applied/);
  assert.match(payment, /Remove/);
  assert.match(payment, /Use wallet balance/);
});
test('checkout Next remains disabled until the current step is valid', () => {
  assert.match(page, /disabled={!valid}/);
  assert.match(page, /Fix the issue above to continue/);
});
