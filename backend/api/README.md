# Checkout and payments

The checkout flow re-prices the authenticated cart server-side, reserves stock for 15 minutes, creates one parent order with one sub-order per vendor, and confirms online orders only after Razorpay signature verification or webhook capture. Monetary values are integer paise.

For local Razorpay testing, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`, use Razorpay test keys, and expose the local API with ngrok. Configure the webhook URL as `https://<ngrok-host>/api/v1/webhooks/razorpay`; the raw-body signature must be preserved by the app bootstrap.

Useful checks:

- `npm run prisma:generate -w backend/api`
- `npm run typecheck -w backend/api`
- `npm run test -w backend/api`
- `npm run typecheck -w frontend/storefront`

Manual QA: add as guest, sign in and merge the cart, change quantities at the stock boundary, verify pincode autofill/serviceability, edit each checkout step after refresh, test price/stock change conflicts, close Razorpay and retry, verify payment through the browser and webhook-only paths, confirm COD/Wallet totals, inspect vendor-split confirmation cards, and ensure a repeated webhook does not duplicate payment/notification work.
