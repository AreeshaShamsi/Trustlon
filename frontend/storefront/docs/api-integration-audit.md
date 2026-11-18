# Frontend API integration audit

Audit date: 2026-11-18. Paths below are relative to the monorepo root unless stated otherwise.

## Configuration and findings

- Existing browser transport: `frontend/storefront/src/lib/http.ts`. No Axios or React Query client or server actions were found. Hooks and feature services use this transport. Localisation content uses native fetch with the shared proxy path.
- Browsers continue calling same-origin `/api/v1/...`; Next.js forwards to `NEXT_PUBLIC_API_URL`. Server rendering and middleware use that same upstream directly. This retains credentials, refresh-cookie behavior, authorization, error handling, downloads, uploads, cancellation and caching.
- Removed separate legacy `API_URL` localhost fallbacks from storefront proxy, product loader, site loader and middleware. No endpoint paths were changed. The shared upstream requires exactly one `/api/v1` prefix. No hardcoded backend host remains in storefront application source.
- `.env.local` selects `http://localhost:4000/api/v1`. Both `.env.production` and `.env.production.local` select `https://trustlonbackend.vercel.app/api/v1`. The third file is necessary because Next.js otherwise loads `.env.local` ahead of `.env.production`. Existing process/deployment environment variables take precedence.
- These three environment files are ignored by Git and contain only a public URL. The tracked `.env.example` documents the new setting. No credentials were added.
- The separate admin app was audited but not reconfigured: it retains its own `API_URL` setting (origin only, without `/api/v1`) and storefront translation proxy. Its deployment must configure that setting separately.
- Fonts, Razorpay checkout SDK, image URLs and frontend canonical `NEXT_PUBLIC_SITE_URL` are not backend API requests and remain unchanged.

## Endpoint counts and scope

- 230 backend HTTP method/path declarations discovered across all controllers, with global prefix `/api/v1` and custom admin controller prefixes resolved.
- Storefront references 109 distinct declared routes; admin references 107. Their union is 215 routes (one shared route). All 215 match declared HTTP methods and paths statically; no method/path mismatches found.
- Dynamic admin action helpers were expanded from their call sites. Conditional create/edit methods were paired with their correct paths. Generic transport internals and `/storefront-i18n` (a Next rewrite, not a Nest route) were excluded.
- Static verification means a corresponding controller declaration exists; it does not establish live success, payload correctness, database readiness or authorization for all users.
- Live local probes cover 25 distinct GET routes: 8 returned HTTP 200, 8 returned expected unauthenticated HTTP 401, and 9 returned HTTP 500 with valid input. Two initial incomplete/invalid query probes returned HTTP 400 and were retried using the controller DTO parameters.
- Production: 2 GET routes attempted, 0 responses received; network access returned EACCES. Production health and functionality remain unverified.

## Checks

- `npm run build` in frontend/storefront: PASS (Next.js 15.5.29, 33 static pages). The generated routes manifest points `/api/v1/:path*` to `https://trustlonbackend.vercel.app/api/v1/:path*`.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 57 tests including 3 new integration/configuration regressions.
- No ESLint configuration or lint script exists. `npm run lint --if-present` is a no-op, not a successful lint audit. Prettier was used to check changed code files.
- Started a temporary Next development server on port 3107; GET `/api/v1/health` through its proxy returned HTTP 200. That server was stopped after testing; the pre-existing backend process was left running.
- Environment precedence tests load the actual Next.js env loader in separate processes and verify development and production URLs. Mocked transport tests verify refresh retry, bearer/header preservation, JSON method/body and multipart body/content-type behavior.
- No login/signup/OTP/reset/payment/order or other mutation endpoint was exercised. Authenticated end-to-end flows still need a test account. No backend business logic, database, migrations or production data were changed; no commits or pushes.

## Local HTTP observations

| Request under /api/v1 | HTTP result |
| --- | --- |
| GET `/health` | 200 |
| GET `/site/config` | 500 |
| GET `/site/content/en` | 500 |
| GET `/site/seo` | 400 |
| GET `/site/redirects` | 500 |
| GET `/site/sitemap` | 500 |
| GET `/categories` | 500 |
| GET `/products?limit=1` | 400 |
| GET `/products/facets` | 200 |
| GET `/products/by-ids` | 200 |
| GET `/search?q=phone` | 200 |
| GET `/search/suggest?q=phone` | 200 |
| GET `/stores` | 500 |
| GET `/local/sellers?pincode=244001&radius=10` | 200 |
| GET `/local/products?pincode=244001&radius=10` | 200 |
| GET `/location/countries` | 200 |
| GET `/public/commission-rates` | 500 |
| GET `/auth/me` | 401 |
| GET `/me/addresses` | 401 |
| GET `/me/settings` | 401 |
| GET `/orders` | 401 |
| GET `/wallet` | 401 |
| GET `/tickets` | 401 |
| GET `/admin/auth/me` | 401 |
| GET `/admin/products` | 401 |
| GET `/products?pageSize=1` | 500 |
| GET `/site/seo?entity=HOME&key=home` | 500 |

HTTP 500 bodies were generic “Internal server error”. Their backend/database cause was not established by this frontend audit and was not changed. HTTP 401 verifies rejection without credentials, not authenticated functionality. HTTP 200 responses may be empty; no claim is made that catalog data is populated.

## Production HTTP observations

- GET `/health`: EACCES; no HTTP response. A web-tool attempt also could not access the health URL.
- GET `/products?limit=1`: EACCES; no HTTP response. A web-tool attempt also could not access the health URL.

## Files changed

All deliverable changes are within `frontend/storefront/`:

- `.env.example`
- `.env.local (created; ignored)`
- `.env.production (created; ignored)`
- `.env.production.local (created; ignored)`
- `next.config.ts`
- `package.json`
- `src/lib/api-url.ts (created)`
- `src/lib/http.ts`
- `src/lib/site-config.server.ts`
- `src/lib/i18n/language-provider.tsx`
- `src/features/product/server.ts`
- `src/middleware.ts`
- `src/features/local/README.md`
- `tests/api-integration.test.cjs (created)`
- `docs/api-integration-audit.md (created)`

Temporary inventory/probe scripts and JSON results were written only under ignored `node_modules/.cache/`. The pre-existing untracked `dump.sql` was untouched.

## Deployment and manual follow-up

1. In the storefront Vercel project, set `NEXT_PUBLIC_API_URL=https://trustlonbackend.vercel.app/api/v1` for Production (and configure Preview separately as intended), then rebuild/redeploy. Public env values and rewrites are build-time configuration. An inherited process env can override the checked files.
2. For a fresh checkout, copy `.env.example` to `.env.local`. Recreate `.env.production` and `.env.production.local` with the production URL above when building production locally; these files are intentionally ignored by the existing repository rules.
3. From the monorepo root run `npm run dev:api` and `npm run dev:storefront`. For production locally run `npm run build -w frontend/storefront` then `npm run start -w frontend/storefront`.
4. In browser Network tools, requests should use the storefront origin `/api/v1/...`. Local Next forwards to localhost:4000; production Next forwards to the Vercel backend. No CORS/security relaxation is needed for this existing architecture.
5. Investigate the listed local backend HTTP 500s using backend logs and database readiness. No migrations were run. Re-test production health/catalog from a network with access, then login/refresh/logout and account flows using an authorized test account.
6. Configure `NEXT_PUBLIC_SITE_URL` separately to the deployed storefront origin for canonical URLs/sitemaps. It is not the backend URL. If deploying the separate admin app, its existing `API_URL` must be `https://trustlonbackend.vercel.app`.

## Full route inventory

Includes authentication (signup/login/logout/refresh/reset/OTP), profile/contact/addresses, catalog/search, vendors/local delivery, cart/checkout, orders/payments/webhooks, admin and all remaining modules. “No frontend call found” is not a missing route: some endpoints are intended for webhooks or assets.

| Method | Backend path | Frontend references | Controller |
| --- | --- | --- | --- |
| GET | `/api/v1/me/summary` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/account/account.controller.ts:13` |
| GET | `/api/v1/me/addresses` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/addresses/addresses.controller.ts:27` |
| POST | `/api/v1/me/addresses` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/addresses/addresses.controller.ts:33` |
| PUT | `/api/v1/me/addresses/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/addresses/addresses.controller.ts:38` |
| POST | `/api/v1/me/addresses/:id/default` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/addresses/addresses.controller.ts:47` |
| DELETE | `/api/v1/me/addresses/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/addresses/addresses.controller.ts:53` |
| GET | `/api/v1/admin/categories` | `frontend/admin/src/features/catalog/CategoriesPage.tsx`<br>`frontend/admin/src/features/marketing/CouponsPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:36` |
| POST | `/api/v1/admin/categories` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:42` |
| POST | `/api/v1/admin/categories/reorder` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:48` |
| PATCH | `/api/v1/admin/categories/:id` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:55` |
| DELETE | `/api/v1/admin/categories/:id` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:66` |
| GET | `/api/v1/admin/categories/:id/attributes` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:77` |
| PUT | `/api/v1/admin/categories/:id/attributes` | `frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:83` |
| GET | `/api/v1/admin/attributes` | `frontend/admin/src/features/catalog/AttributesPage.tsx`<br>`frontend/admin/src/features/catalog/CategoriesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:94` |
| POST | `/api/v1/admin/attributes` | `frontend/admin/src/features/catalog/AttributesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:100` |
| PATCH | `/api/v1/admin/attributes/:id` | `frontend/admin/src/features/catalog/AttributesPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:106` |
| GET | `/api/v1/admin/hsn` | `frontend/admin/src/features/catalog/HsnPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:117` |
| POST | `/api/v1/admin/hsn` | `frontend/admin/src/features/catalog/HsnPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:123` |
| DELETE | `/api/v1/admin/hsn/:id` | `frontend/admin/src/features/catalog/HsnPage.tsx` | `backend/api/src/modules/admin/catalog/catalog.controller.ts:129` |
| POST | `/api/v1/admin/assets` | `frontend/admin/src/components/ImageField.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:51` |
| GET | `/api/v1/admin/coupons` | `frontend/admin/src/features/marketing/CouponsPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:79` |
| POST | `/api/v1/admin/coupons` | `frontend/admin/src/features/marketing/CouponsPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:85` |
| PATCH | `/api/v1/admin/coupons/:id` | `frontend/admin/src/features/marketing/CouponsPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:91` |
| GET | `/api/v1/admin/seo` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:102` |
| PUT | `/api/v1/admin/seo` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:108` |
| GET | `/api/v1/admin/seo/sitemap` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:114` |
| GET | `/api/v1/admin/redirects` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:120` |
| POST | `/api/v1/admin/redirects` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:126` |
| DELETE | `/api/v1/admin/redirects/:id` | `frontend/admin/src/features/marketing/SeoPage.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:132` |
| GET | `/api/v1/admin/pages` | `frontend/admin/src/features/marketing/PagesList.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:142` |
| GET | `/api/v1/admin/pages/:id` | `frontend/admin/src/features/marketing/PageEditor.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:148` |
| POST | `/api/v1/admin/pages` | `frontend/admin/src/features/marketing/PageEditor.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:154` |
| PATCH | `/api/v1/admin/pages/:id` | `frontend/admin/src/features/marketing/PageEditor.tsx` | `backend/api/src/modules/admin/content/content.controller.ts:160` |
| GET | `/api/v1/admin/customers` | `frontend/admin/src/features/customers/CustomersList.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:37` |
| GET | `/api/v1/admin/customers/:id` | `frontend/admin/src/features/customers/CustomerDetailPage.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:51` |
| PATCH | `/api/v1/admin/customers/:id/status` | `frontend/admin/src/features/customers/CustomerDetailPage.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:57` |
| PATCH | `/api/v1/admin/customers/:id/cod` | `frontend/admin/src/features/customers/CustomerDetailPage.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:68` |
| POST | `/api/v1/admin/customers/:id/b2b` | `frontend/admin/src/features/customers/CustomerDetailPage.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:79` |
| POST | `/api/v1/admin/customers/:id/wallet-adjustment` | `frontend/admin/src/features/customers/CustomerDetailPage.tsx` | `backend/api/src/modules/admin/customers/customers.controller.ts:91` |
| GET | `/api/v1/admin/dashboard/summary` | `frontend/admin/src/features/dashboard/Dashboard.tsx` | `backend/api/src/modules/admin/dashboard/dashboard.controller.ts:10` |
| GET | `/api/v1/admin/orders` | `frontend/admin/src/features/orders/OrdersList.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:32` |
| GET | `/api/v1/admin/orders/:id` | `frontend/admin/src/features/orders/OrderDetailPage.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:46` |
| POST | `/api/v1/admin/orders/:id/cancel` | `frontend/admin/src/features/orders/OrderDetailPage.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:52` |
| POST | `/api/v1/admin/orders/:id/refund` | `frontend/admin/src/features/orders/OrderDetailPage.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:64` |
| POST | `/api/v1/admin/orders/:id/reassign-courier` | `frontend/admin/src/features/orders/OrderDetailPage.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:76` |
| POST | `/api/v1/admin/orders/:id/notes` | `frontend/admin/src/features/orders/OrderDetailPage.tsx` | `backend/api/src/modules/admin/orders/orders.controller.ts:88` |
| GET | `/api/v1/admin/products/moderation` | `frontend/admin/src/features/catalog/ProductsPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:31` |
| GET | `/api/v1/admin/products` | `frontend/admin/src/features/catalog/ProductsPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:37` |
| GET | `/api/v1/admin/products/:id` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx`<br>`frontend/admin/src/features/catalog/ProductsPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:51` |
| POST | `/api/v1/admin/products/:id/approve` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:57` |
| POST | `/api/v1/admin/products/:id/reject` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:69` |
| POST | `/api/v1/admin/products/:id/request-changes` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:81` |
| POST | `/api/v1/admin/products/:id/authenticity` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:93` |
| POST | `/api/v1/admin/products/:id/deactivate` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:105` |
| POST | `/api/v1/admin/products/:id/reactivate` | `frontend/admin/src/features/catalog/ProductDetailPage.tsx` | `backend/api/src/modules/admin/products/products.controller.ts:117` |
| GET | `/api/v1/admin/settings` | `frontend/admin/src/features/settings/SettingsIndex.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:168` |
| GET | `/api/v1/admin/settings/localisation/content` | `frontend/admin/src/features/settings/LocalisationPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:191` |
| PUT | `/api/v1/admin/settings/localisation/content` | `frontend/admin/src/features/settings/LocalisationPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:197` |
| DELETE | `/api/v1/admin/settings/localisation/content` | `frontend/admin/src/features/settings/LocalisationPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:208` |
| GET | `/api/v1/admin/settings/shipping/pincodes` | `frontend/admin/src/features/settings/ShippingSettings.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:221` |
| PATCH | `/api/v1/admin/settings/shipping/pincodes/:pincode` | `frontend/admin/src/features/settings/ShippingSettings.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:247` |
| POST | `/api/v1/admin/settings/shipping/pincodes/bulk` | `frontend/admin/src/features/settings/ShippingSettings.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:270` |
| POST | `/api/v1/admin/settings/theme/logo` | `frontend/admin/src/features/settings/ThemeSettings.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:295` |
| GET | `/api/v1/admin/settings/:group` | `frontend/admin/src/features/orders/OrderDetailPage.tsx`<br>`frontend/admin/src/features/settings/SettingsGroupPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:319` |
| PATCH | `/api/v1/admin/settings/:group` | `frontend/admin/src/features/settings/SettingsGroupPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:326` |
| POST | `/api/v1/admin/settings/:group/reset` | `frontend/admin/src/features/settings/SettingsGroupPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:338` |
| GET | `/api/v1/admin/settings/:group/versions` | `frontend/admin/src/features/settings/SettingsGroupPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:346` |
| POST | `/api/v1/admin/settings/:group/versions/:version/restore` | `frontend/admin/src/features/settings/SettingsGroupPage.tsx` | `backend/api/src/modules/admin/settings/settings.controller.ts:353` |
| GET | `/api/v1/admin/staff` | `frontend/admin/src/features/staff/StaffPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:34` |
| POST | `/api/v1/admin/staff` | `frontend/admin/src/features/staff/StaffPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:40` |
| PATCH | `/api/v1/admin/staff/:id` | `frontend/admin/src/features/staff/StaffPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:46` |
| POST | `/api/v1/admin/staff/:id/reset-2fa` | `frontend/admin/src/features/staff/StaffPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:57` |
| POST | `/api/v1/admin/staff/:id/reset-password` | `frontend/admin/src/features/staff/StaffPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:69` |
| GET | `/api/v1/admin/roles` | `frontend/admin/src/features/staff/RolesPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:81` |
| PATCH | `/api/v1/admin/roles/:role` | `frontend/admin/src/features/staff/RolesPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:87` |
| POST | `/api/v1/admin/roles/:role/reset` | `frontend/admin/src/features/staff/RolesPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:98` |
| GET | `/api/v1/admin/audit-log` | `frontend/admin/src/features/staff/AuditLogPage.tsx` | `backend/api/src/modules/admin/staff/staff.controller.ts:109` |
| GET | `/api/v1/admin/reviews/flagged` | `frontend/admin/src/features/trust/ReviewModeration.tsx` | `backend/api/src/modules/admin/trust/trust.controller.ts:38` |
| POST | `/api/v1/admin/reviews/:id/action` | `frontend/admin/src/features/trust/ReviewModeration.tsx` | `backend/api/src/modules/admin/trust/trust.controller.ts:44` |
| GET | `/api/v1/admin/reports` | `frontend/admin/src/features/trust/ReportsPage.tsx` | `backend/api/src/modules/admin/trust/trust.controller.ts:56` |
| POST | `/api/v1/admin/reports/:id/action` | `frontend/admin/src/features/trust/ReportsPage.tsx` | `backend/api/src/modules/admin/trust/trust.controller.ts:62` |
| POST | `/api/v1/reports` | No frontend call found | `backend/api/src/modules/admin/trust/trust.controller.ts:85` |
| GET | `/api/v1/admin/vendors` | `frontend/admin/src/features/vendors/VendorsList.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:43` |
| GET | `/api/v1/admin/vendors/:id` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:57` |
| GET | `/api/v1/admin/vendors/:id/documents/:documentId` | `frontend/admin/src/features/vendors/DocumentViewer.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:63` |
| GET | `/api/v1/admin/kyc/queue` | `frontend/admin/src/features/vendors/KycQueue.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:78` |
| GET | `/api/v1/admin/kyc/reasons` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:84` |
| POST | `/api/v1/admin/kyc/:vendorId/approve` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:90` |
| POST | `/api/v1/admin/kyc/:vendorId/reject` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:101` |
| POST | `/api/v1/admin/kyc/:vendorId/request-documents` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:112` |
| POST | `/api/v1/admin/vendors/:id/suspend` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:123` |
| POST | `/api/v1/admin/vendors/:id/reinstate` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:134` |
| PATCH | `/api/v1/admin/vendors/:id/commission` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:145` |
| PATCH | `/api/v1/admin/vendors/:id/verified` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:156` |
| PATCH | `/api/v1/admin/vendors/:id/payout-hold` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:167` |
| PATCH | `/api/v1/admin/vendors/:id/review` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:178` |
| POST | `/api/v1/admin/vendors/:id/notes` | `frontend/admin/src/features/vendors/VendorDetailPage.tsx` | `backend/api/src/modules/admin/vendors/vendors.controller.ts:189` |
| POST | `/api/v1/admin/auth/login` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:41` |
| POST | `/api/v1/admin/auth/password` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:48` |
| POST | `/api/v1/admin/auth/2fa/setup` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:55` |
| POST | `/api/v1/admin/auth/2fa/enroll` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:62` |
| POST | `/api/v1/admin/auth/2fa/verify` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:74` |
| POST | `/api/v1/admin/auth/refresh` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:88` |
| POST | `/api/v1/admin/auth/logout` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:99` |
| GET | `/api/v1/admin/auth/me` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:106` |
| PATCH | `/api/v1/admin/auth/me/password` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:112` |
| POST | `/api/v1/admin/auth/me/recovery-codes` | `frontend/admin/src/features/auth/api.ts` | `backend/api/src/modules/admin-auth/admin-auth.controller.ts:123` |
| GET | `/api/v1/affiliate/summary` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/affiliate/affiliate.controller.ts:25` |
| GET | `/api/v1/affiliate/links` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/affiliate/affiliate.controller.ts:32` |
| POST | `/api/v1/affiliate/links` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/affiliate/affiliate.controller.ts:39` |
| GET | `/api/v1/affiliate/earnings` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/affiliate/affiliate.controller.ts:46` |
| POST | `/api/v1/affiliate/clicks/:code` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/affiliate/affiliate.controller.ts:54` |
| POST | `/api/v1/auth/otp/send` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:41` |
| POST | `/api/v1/auth/otp/verify` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:48` |
| POST | `/api/v1/auth/signup/validate` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:66` |
| POST | `/api/v1/auth/signup` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:73` |
| POST | `/api/v1/auth/login` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:83` |
| POST | `/api/v1/auth/refresh` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:94` |
| POST | `/api/v1/auth/logout` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:105` |
| POST | `/api/v1/auth/password/forgot` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:112` |
| POST | `/api/v1/auth/password/reset` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:119` |
| GET | `/api/v1/auth/me` | `frontend/storefront/src/features/auth/api.ts` | `backend/api/src/modules/auth/auth.controller.ts:128` |
| GET | `/api/v1/me/b2b` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/b2b/b2b.controller.ts:24` |
| POST | `/api/v1/me/b2b` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/b2b/b2b.controller.ts:30` |
| POST | `/api/v1/kyc/gstin/verify` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/b2b/b2b.controller.ts:38` |
| GET | `/api/v1/categories` | No frontend call found | `backend/api/src/modules/catalog/catalog.controller.ts:15` |
| GET | `/api/v1/categories/:slug` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/catalog/catalog.controller.ts:21` |
| GET | `/api/v1/products` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/catalog/catalog.controller.ts:28` |
| GET | `/api/v1/products/facets` | No frontend call found | `backend/api/src/modules/catalog/catalog.controller.ts:34` |
| GET | `/api/v1/products/by-ids` | `frontend/storefront/src/features/product/ProductDetailsPage.tsx` | `backend/api/src/modules/catalog/catalog.controller.ts:41` |
| GET | `/api/v1/products/:slug` | `frontend/storefront/src/features/home/api.ts`<br>`frontend/storefront/src/features/product/ProductDetailsPage.tsx`<br>`frontend/storefront/src/features/product/server.ts` | `backend/api/src/modules/catalog/catalog.controller.ts:47` |
| GET | `/api/v1/search` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/catalog/catalog.controller.ts:52` |
| GET | `/api/v1/search/suggest` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/catalog/catalog.controller.ts:57` |
| POST | `/api/v1/checkout/validate` | `frontend/storefront/src/features/checkout/api.ts` | `backend/api/src/modules/checkout/checkout.controller.ts:12` |
| POST | `/api/v1/orders` | `frontend/storefront/src/features/checkout/api.ts` | `backend/api/src/modules/checkout/checkout.controller.ts:14` |
| POST | `/api/v1/payments/razorpay/order` | `frontend/storefront/src/features/checkout/api.ts` | `backend/api/src/modules/checkout/checkout.controller.ts:16` |
| POST | `/api/v1/payments/razorpay/verify` | `frontend/storefront/src/features/checkout/api.ts` | `backend/api/src/modules/checkout/checkout.controller.ts:18` |
| POST | `/api/v1/webhooks/razorpay` | No frontend call found | `backend/api/src/modules/checkout/checkout.controller.ts:20` |
| GET | `/api/v1/health` | No frontend call found | `backend/api/src/modules/health/health.controller.ts:10` |
| GET | `/api/v1/home` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/home/home.controller.ts:26` |
| GET | `/api/v1/recommendations` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/home/home.controller.ts:33` |
| GET | `/api/v1/pincode/search` | `frontend/storefront/src/lib/location.ts` | `backend/api/src/modules/location/location.controller.ts:30` |
| GET | `/api/v1/pincode/:pincode/serviceability` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/location/location.controller.ts:38` |
| GET | `/api/v1/pincode/:pincode` | `frontend/storefront/src/lib/location.ts` | `backend/api/src/modules/location/location.controller.ts:48` |
| GET | `/api/v1/location/countries` | `frontend/storefront/src/lib/location.ts` | `backend/api/src/modules/location/location.controller.ts:69` |
| GET | `/api/v1/location/countries/:code/states` | `frontend/storefront/src/lib/location.ts` | `backend/api/src/modules/location/location.controller.ts:75` |
| GET | `/api/v1/location/countries/:code/cities` | `frontend/storefront/src/lib/location.ts` | `backend/api/src/modules/location/location.controller.ts:82` |
| GET | `/api/v1/admin/marketing/banners` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:37` |
| POST | `/api/v1/admin/marketing/banners` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:43` |
| PATCH | `/api/v1/admin/marketing/banners/:id` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:61` |
| DELETE | `/api/v1/admin/marketing/banners/:id` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:80` |
| GET | `/api/v1/admin/marketing/home-sections` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:96` |
| PUT | `/api/v1/admin/marketing/home-sections` | `frontend/admin/src/features/marketing/BannersPage.tsx` | `backend/api/src/modules/marketing/marketing.controller.ts:102` |
| GET | `/api/v1/admin/marketing/deals` | No frontend call found | `backend/api/src/modules/marketing/marketing.controller.ts:120` |
| POST | `/api/v1/admin/marketing/deals` | No frontend call found | `backend/api/src/modules/marketing/marketing.controller.ts:126` |
| PATCH | `/api/v1/admin/marketing/deals/:id` | No frontend call found | `backend/api/src/modules/marketing/marketing.controller.ts:139` |
| DELETE | `/api/v1/admin/marketing/deals/:id` | No frontend call found | `backend/api/src/modules/marketing/marketing.controller.ts:157` |
| PATCH | `/api/v1/admin/marketing/stores/:slug/featured` | No frontend call found | `backend/api/src/modules/marketing/marketing.controller.ts:173` |
| GET | `/api/v1/orders` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/orders/orders.controller.ts:34` |
| GET | `/api/v1/orders/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/orders/orders.controller.ts:40` |
| POST | `/api/v1/sub-orders/:id/cancel` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/orders/orders.controller.ts:47` |
| GET | `/api/v1/invoices/:id/pdf` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/orders/orders.controller.ts:59` |
| GET | `/api/v1/shipments/:awb/tracking` | No frontend call found | `backend/api/src/modules/orders/orders.controller.ts:74` |
| GET | `/api/v1/me/price-alerts` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/price-alerts/price-alerts.controller.ts:51` |
| POST | `/api/v1/me/price-alerts` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/price-alerts/price-alerts.controller.ts:57` |
| PATCH | `/api/v1/me/price-alerts/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/price-alerts/price-alerts.controller.ts:62` |
| DELETE | `/api/v1/me/price-alerts/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/price-alerts/price-alerts.controller.ts:71` |
| GET | `/api/v1/returns` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:33` |
| GET | `/api/v1/returns/eligibility/:subOrderId` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:40` |
| POST | `/api/v1/returns/photos` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:50` |
| GET | `/api/v1/returns/photos/:photoId` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:57` |
| POST | `/api/v1/returns` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:68` |
| GET | `/api/v1/returns/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:74` |
| POST | `/api/v1/returns/:id/cancel` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/returns/returns.controller.ts:81` |
| GET | `/api/v1/me/reviews` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/reviews/reviews.controller.ts:33` |
| POST | `/api/v1/reviews` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/reviews/reviews.controller.ts:40` |
| PATCH | `/api/v1/reviews/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/reviews/reviews.controller.ts:51` |
| POST | `/api/v1/reviews/media` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/reviews/reviews.controller.ts:63` |
| GET | `/api/v1/reviews/media/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/reviews/reviews.controller.ts:74` |
| GET | `/api/v1/public/commission-rates` | `frontend/storefront/src/features/sell/api.ts` | `backend/api/src/modules/sell/sell.controller.ts:12` |
| POST | `/api/v1/public/fee-calculator` | `frontend/storefront/src/features/sell/api.ts` | `backend/api/src/modules/sell/sell.controller.ts:18` |
| POST | `/api/v1/public/vendor-leads` | `frontend/storefront/src/features/sell/api.ts` | `backend/api/src/modules/sell/sell.controller.ts:25` |
| GET | `/api/v1/me/settings` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:44` |
| PATCH | `/api/v1/me` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:50` |
| POST | `/api/v1/me/contact/otp` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:55` |
| POST | `/api/v1/me/contact/verify` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:62` |
| POST | `/api/v1/me/password` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:69` |
| GET | `/api/v1/me/sessions` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:76` |
| DELETE | `/api/v1/me/sessions/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:82` |
| DELETE | `/api/v1/me/sessions` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:91` |
| PATCH | `/api/v1/me/notification-preferences` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:96` |
| POST | `/api/v1/me/data-export` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:101` |
| POST | `/api/v1/me/delete` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/settings/settings.controller.ts:111` |
| GET | `/api/v1/cart` | `frontend/storefront/src/features/cart/api.ts`<br>`frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:31` |
| POST | `/api/v1/cart/items` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:36` |
| PATCH | `/api/v1/cart/items/:id` | `frontend/storefront/src/features/cart/api.ts`<br>`frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:42` |
| DELETE | `/api/v1/cart/items/:id` | `frontend/storefront/src/features/cart/api.ts`<br>`frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:51` |
| DELETE | `/api/v1/cart` | No frontend call found | `backend/api/src/modules/shopping/shopping.controller.ts:56` |
| POST | `/api/v1/cart/coupon` | `frontend/storefront/src/features/cart/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:61` |
| DELETE | `/api/v1/cart/coupon` | `frontend/storefront/src/features/cart/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:67` |
| GET | `/api/v1/me/recently-viewed` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:78` |
| POST | `/api/v1/me/recently-viewed` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:84` |
| DELETE | `/api/v1/me/recently-viewed` | No frontend call found | `backend/api/src/modules/shopping/shopping.controller.ts:90` |
| GET | `/api/v1/me/wishlist` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:102` |
| GET | `/api/v1/me/wishlist/ids` | No frontend call found | `backend/api/src/modules/shopping/shopping.controller.ts:108` |
| PUT | `/api/v1/me/wishlist/:productId` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:113` |
| DELETE | `/api/v1/me/wishlist/:productId` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/shopping/shopping.controller.ts:118` |
| GET | `/api/v1/site/config` | `frontend/storefront/src/lib/site-config.server.ts`<br>`frontend/admin/src/lib/site-config.server.ts` | `backend/api/src/modules/site/site.controller.ts:57` |
| GET | `/api/v1/site/content/:language` | `frontend/storefront/src/lib/i18n/language-provider.tsx`<br>`frontend/storefront/src/lib/site-config.server.ts` | `backend/api/src/modules/site/site.controller.ts:63` |
| GET | `/api/v1/site/assets/:name` | No frontend call found | `backend/api/src/modules/site/site.controller.ts:70` |
| GET | `/api/v1/site/pages/:slug` | `frontend/storefront/src/lib/site-config.server.ts` | `backend/api/src/modules/site/site.controller.ts:83` |
| GET | `/api/v1/site/seo` | `frontend/storefront/src/lib/site-config.server.ts` | `backend/api/src/modules/site/site.controller.ts:98` |
| GET | `/api/v1/site/redirects` | `frontend/storefront/src/middleware.ts` | `backend/api/src/modules/site/site.controller.ts:108` |
| GET | `/api/v1/site/sitemap` | `frontend/storefront/src/lib/site-config.server.ts` | `backend/api/src/modules/site/site.controller.ts:122` |
| GET | `/api/v1/me/stores/delivery` | `frontend/storefront/src/features/local/seller-api.ts` | `backend/api/src/modules/stores/seller-delivery.controller.ts:26` |
| PUT | `/api/v1/me/stores/:id/delivery` | `frontend/storefront/src/features/local/seller-api.ts` | `backend/api/src/modules/stores/seller-delivery.controller.ts:32` |
| GET | `/api/v1/stores` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/stores/stores.controller.ts:11` |
| GET | `/api/v1/stores/:slug` | `frontend/storefront/src/features/home/api.ts` | `backend/api/src/modules/stores/stores.controller.ts:20` |
| GET | `/api/v1/local/sellers` | `frontend/storefront/src/features/home/api.ts`<br>`frontend/storefront/src/features/local/api.ts` | `backend/api/src/modules/stores/stores.controller.ts:26` |
| GET | `/api/v1/local/products` | `frontend/storefront/src/features/local/api.ts` | `backend/api/src/modules/stores/stores.controller.ts:33` |
| GET | `/api/v1/tickets` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:33` |
| GET | `/api/v1/tickets/categories` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:40` |
| POST | `/api/v1/tickets/attachments` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:47` |
| GET | `/api/v1/tickets/attachments/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:54` |
| POST | `/api/v1/tickets` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:69` |
| GET | `/api/v1/tickets/:id` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:75` |
| POST | `/api/v1/tickets/:id/messages` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:81` |
| POST | `/api/v1/tickets/:id/resolve` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/support/support.controller.ts:91` |
| GET | `/api/v1/wallet` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/wallet/wallet.controller.ts:22` |
| GET | `/api/v1/wallet/transactions` | `frontend/storefront/src/features/account/api.ts` | `backend/api/src/modules/wallet/wallet.controller.ts:28` |

## Files inspected

The source inventory scanned all 243 storefront and 109 admin source files plus 34 backend controller files (386 total). API call sites and dynamic helpers were compared against controller declarations. Configuration, package scripts, env files, app setup/module registration, auth cookies/CORS and related DTOs were also inspected. The complete source inventory follows:

- `backend/api/src/modules/account/account.controller.ts`
- `backend/api/src/modules/addresses/addresses.controller.ts`
- `backend/api/src/modules/admin/catalog/catalog.controller.ts`
- `backend/api/src/modules/admin/content/content.controller.ts`
- `backend/api/src/modules/admin/customers/customers.controller.ts`
- `backend/api/src/modules/admin/dashboard/dashboard.controller.ts`
- `backend/api/src/modules/admin/orders/orders.controller.ts`
- `backend/api/src/modules/admin/products/products.controller.ts`
- `backend/api/src/modules/admin/settings/settings.controller.ts`
- `backend/api/src/modules/admin/staff/staff.controller.ts`
- `backend/api/src/modules/admin/trust/trust.controller.ts`
- `backend/api/src/modules/admin/vendors/vendors.controller.ts`
- `backend/api/src/modules/admin-auth/admin-auth.controller.ts`
- `backend/api/src/modules/affiliate/affiliate.controller.ts`
- `backend/api/src/modules/auth/auth.controller.ts`
- `backend/api/src/modules/b2b/b2b.controller.ts`
- `backend/api/src/modules/catalog/catalog.controller.ts`
- `backend/api/src/modules/checkout/checkout.controller.ts`
- `backend/api/src/modules/health/health.controller.ts`
- `backend/api/src/modules/home/home.controller.ts`
- `backend/api/src/modules/location/location.controller.ts`
- `backend/api/src/modules/marketing/marketing.controller.ts`
- `backend/api/src/modules/orders/orders.controller.ts`
- `backend/api/src/modules/price-alerts/price-alerts.controller.ts`
- `backend/api/src/modules/returns/returns.controller.ts`
- `backend/api/src/modules/reviews/reviews.controller.ts`
- `backend/api/src/modules/sell/sell.controller.ts`
- `backend/api/src/modules/settings/settings.controller.ts`
- `backend/api/src/modules/shopping/shopping.controller.ts`
- `backend/api/src/modules/site/site.controller.ts`
- `backend/api/src/modules/stores/seller-delivery.controller.ts`
- `backend/api/src/modules/stores/stores.controller.ts`
- `backend/api/src/modules/support/support.controller.ts`
- `backend/api/src/modules/wallet/wallet.controller.ts`
- `frontend/storefront/src/app/(auth)/forgot-password/page.tsx`
- `frontend/storefront/src/app/(auth)/layout.tsx`
- `frontend/storefront/src/app/(auth)/login/page.tsx`
- `frontend/storefront/src/app/(auth)/signup/page.tsx`
- `frontend/storefront/src/app/account/addresses/page.tsx`
- `frontend/storefront/src/app/account/affiliate/page.tsx`
- `frontend/storefront/src/app/account/b2b/page.tsx`
- `frontend/storefront/src/app/account/layout.tsx`
- `frontend/storefront/src/app/account/orders/page.tsx`
- `frontend/storefront/src/app/account/orders/[id]/page.tsx`
- `frontend/storefront/src/app/account/page.tsx`
- `frontend/storefront/src/app/account/price-alerts/page.tsx`
- `frontend/storefront/src/app/account/returns/new/page.tsx`
- `frontend/storefront/src/app/account/returns/page.tsx`
- `frontend/storefront/src/app/account/returns/[id]/page.tsx`
- `frontend/storefront/src/app/account/reviews/page.tsx`
- `frontend/storefront/src/app/account/seller/page.tsx`
- `frontend/storefront/src/app/account/settings/page.tsx`
- `frontend/storefront/src/app/account/support/new/page.tsx`
- `frontend/storefront/src/app/account/support/page.tsx`
- `frontend/storefront/src/app/account/support/[id]/page.tsx`
- `frontend/storefront/src/app/account/wallet/page.tsx`
- `frontend/storefront/src/app/account/wishlist/page.tsx`
- `frontend/storefront/src/app/browse/account/page.tsx`
- `frontend/storefront/src/app/browse/orders/page.tsx`
- `frontend/storefront/src/app/browse/sell/page.tsx`
- `frontend/storefront/src/app/browse/[slug]/page.tsx`
- `frontend/storefront/src/app/c/[categorySlug]/page.tsx`
- `frontend/storefront/src/app/cart/page.tsx`
- `frontend/storefront/src/app/checkout/page.tsx`
- `frontend/storefront/src/app/i18n/route.ts`
- `frontend/storefront/src/app/i18n/[lang]/route.ts`
- `frontend/storefront/src/app/layout.tsx`
- `frontend/storefront/src/app/local/page.tsx`
- `frontend/storefront/src/app/p/[productSlug]/loading.tsx`
- `frontend/storefront/src/app/p/[productSlug]/page.tsx`
- `frontend/storefront/src/app/page.tsx`
- `frontend/storefront/src/app/pages/[slug]/page.tsx`
- `frontend/storefront/src/app/r/[code]/page.tsx`
- `frontend/storefront/src/app/robots.ts`
- `frontend/storefront/src/app/search/page.tsx`
- `frontend/storefront/src/app/sell/page.tsx`
- `frontend/storefront/src/app/sitemap.ts`
- `frontend/storefront/src/components/BrandLogo.tsx`
- `frontend/storefront/src/components/LanguagePicker.tsx`
- `frontend/storefront/src/components/location/index.tsx`
- `frontend/storefront/src/components/ui/index.ts`
- `frontend/storefront/src/components/ui/PasswordField.tsx`
- `frontend/storefront/src/components/ui/PhoneField.tsx`
- `frontend/storefront/src/components/ui/primitives.tsx`
- `frontend/storefront/src/design-system/components/Alert/index.tsx`
- `frontend/storefront/src/design-system/components/Button/index.tsx`
- `frontend/storefront/src/design-system/components/Checkbox/index.tsx`
- `frontend/storefront/src/design-system/components/Combobox/index.tsx`
- `frontend/storefront/src/design-system/components/Dialog/index.tsx`
- `frontend/storefront/src/design-system/components/Field.tsx`
- `frontend/storefront/src/design-system/components/index.ts`
- `frontend/storefront/src/design-system/components/ListSelect/index.tsx`
- `frontend/storefront/src/design-system/components/MobileField/index.tsx`
- `frontend/storefront/src/design-system/components/PasswordField/index.tsx`
- `frontend/storefront/src/design-system/components/PhoneField/index.tsx`
- `frontend/storefront/src/design-system/components/TextField/index.tsx`
- `frontend/storefront/src/design-system/index.ts`
- `frontend/storefront/src/design-system/styles/index.ts`
- `frontend/storefront/src/design-system/tokens/colors.ts`
- `frontend/storefront/src/design-system/tokens/index.ts`
- `frontend/storefront/src/design-system/tokens/radius.ts`
- `frontend/storefront/src/design-system/tokens/shadows.ts`
- `frontend/storefront/src/design-system/tokens/spacing.ts`
- `frontend/storefront/src/design-system/tokens/typography.ts`
- `frontend/storefront/src/design-system/utils/cn.ts`
- `frontend/storefront/src/features/account/AccountOverview.tsx`
- `frontend/storefront/src/features/account/AddressBook.tsx`
- `frontend/storefront/src/features/account/AffiliatePage.tsx`
- `frontend/storefront/src/features/account/api.ts`
- `frontend/storefront/src/features/account/BusinessPage.tsx`
- `frontend/storefront/src/features/account/components/AccountShell.tsx`
- `frontend/storefront/src/features/account/components/AddressForm.tsx`
- `frontend/storefront/src/features/account/components/CancelDialog.tsx`
- `frontend/storefront/src/features/account/components/OrderCard.tsx`
- `frontend/storefront/src/features/account/components/PriceAlertDialog.tsx`
- `frontend/storefront/src/features/account/components/TrackingTimeline.tsx`
- `frontend/storefront/src/features/account/components/ui.tsx`
- `frontend/storefront/src/features/account/components/uploads.tsx`
- `frontend/storefront/src/features/account/format.ts`
- `frontend/storefront/src/features/account/index.ts`
- `frontend/storefront/src/features/account/OrderDetailPage.tsx`
- `frontend/storefront/src/features/account/OrdersList.tsx`
- `frontend/storefront/src/features/account/PriceAlertsPage.tsx`
- `frontend/storefront/src/features/account/ReturnDetailPage.tsx`
- `frontend/storefront/src/features/account/ReturnRequestForm.tsx`
- `frontend/storefront/src/features/account/ReturnsList.tsx`
- `frontend/storefront/src/features/account/ReviewsPage.tsx`
- `frontend/storefront/src/features/account/SettingsPage.tsx`
- `frontend/storefront/src/features/account/SupportPages.tsx`
- `frontend/storefront/src/features/account/types.ts`
- `frontend/storefront/src/features/account/WalletPage.tsx`
- `frontend/storefront/src/features/account/WishlistPage.tsx`
- `frontend/storefront/src/features/auth/api.ts`
- `frontend/storefront/src/features/auth/auth-provider.tsx`
- `frontend/storefront/src/features/auth/components/AuthShell.tsx`
- `frontend/storefront/src/features/auth/components/IdentifierField.tsx`
- `frontend/storefront/src/features/auth/components/LoginForm.tsx`
- `frontend/storefront/src/features/auth/components/OtpInput.tsx`
- `frontend/storefront/src/features/auth/components/PasswordRequirements.tsx`
- `frontend/storefront/src/features/auth/components/ResetStepper.tsx`
- `frontend/storefront/src/features/auth/components/SignupForm.tsx`
- `frontend/storefront/src/features/auth/index.ts`
- `frontend/storefront/src/features/auth/schemas.ts`
- `frontend/storefront/src/features/auth/screens.tsx`
- `frontend/storefront/src/features/auth/use-api-error.ts`
- `frontend/storefront/src/features/cart/api.ts`
- `frontend/storefront/src/features/cart/components/CartItemGroup.tsx`
- `frontend/storefront/src/features/cart/components/CartItemRow.tsx`
- `frontend/storefront/src/features/cart/components/CheckoutButton.tsx`
- `frontend/storefront/src/features/cart/components/CoinsToggle.tsx`
- `frontend/storefront/src/features/cart/components/CouponInput.tsx`
- `frontend/storefront/src/features/cart/components/PriceSummary.tsx`
- `frontend/storefront/src/features/cart/components/SavedForLater.tsx`
- `frontend/storefront/src/features/cart/hooks/use-cart.ts`
- `frontend/storefront/src/features/cart/types.ts`
- `frontend/storefront/src/features/category/cache.ts`
- `frontend/storefront/src/features/category/CategoryBreadcrumb.tsx`
- `frontend/storefront/src/features/category/CategoryFilters.tsx`
- `frontend/storefront/src/features/category/CategoryPage.tsx`
- `frontend/storefront/src/features/category/query.ts`
- `frontend/storefront/src/features/category/use-category-products.ts`
- `frontend/storefront/src/features/checkout/api.ts`
- `frontend/storefront/src/features/checkout/components/AddressSelector.tsx`
- `frontend/storefront/src/features/checkout/components/CheckoutStepper.tsx`
- `frontend/storefront/src/features/checkout/components/DeliveryOptions.tsx`
- `frontend/storefront/src/features/checkout/components/GstinField.tsx`
- `frontend/storefront/src/features/checkout/components/OrderSummary.tsx`
- `frontend/storefront/src/features/checkout/components/PaymentMethods.tsx`
- `frontend/storefront/src/features/checkout/components/PlaceOrderButton.tsx`
- `frontend/storefront/src/features/checkout/hooks/use-checkout.ts`
- `frontend/storefront/src/features/checkout/types.ts`
- `frontend/storefront/src/features/home/api.ts`
- `frontend/storefront/src/features/home/BrowsePage.tsx`
- `frontend/storefront/src/features/home/components/CategoryNav.tsx`
- `frontend/storefront/src/features/home/components/CategoryTiles.tsx`
- `frontend/storefront/src/features/home/components/DealsOfTheDay.tsx`
- `frontend/storefront/src/features/home/components/FeaturedBrandStores.tsx`
- `frontend/storefront/src/features/home/components/HeroBannerCarousel.tsx`
- `frontend/storefront/src/features/home/components/HomeFooter.tsx`
- `frontend/storefront/src/features/home/components/HomeHeader.tsx`
- `frontend/storefront/src/features/home/components/Icon.tsx`
- `frontend/storefront/src/features/home/components/LocalSellersStrip.tsx`
- `frontend/storefront/src/features/home/components/MarketplaceDialogs.tsx`
- `frontend/storefront/src/features/home/components/PlaceholderVisual.tsx`
- `frontend/storefront/src/features/home/components/ProductCard.tsx`
- `frontend/storefront/src/features/home/components/ProductImage.tsx`
- `frontend/storefront/src/features/home/components/RecentlyViewed.tsx`
- `frontend/storefront/src/features/home/components/RecommendedForYou.tsx`
- `frontend/storefront/src/features/home/components/ReferenceMarketplaceSections.tsx`
- `frontend/storefront/src/features/home/components/ScrollSection.tsx`
- `frontend/storefront/src/features/home/components/SectionStates.tsx`
- `frontend/storefront/src/features/home/components/TrustlonBrandSection.tsx`
- `frontend/storefront/src/features/home/components/TrustStrip.tsx`
- `frontend/storefront/src/features/home/format.ts`
- `frontend/storefront/src/features/home/guest.ts`
- `frontend/storefront/src/features/home/home-provider.tsx`
- `frontend/storefront/src/features/home/HomePage.tsx`
- `frontend/storefront/src/features/home/index.ts`
- `frontend/storefront/src/features/home/types/index.ts`
- `frontend/storefront/src/features/local/api.ts`
- `frontend/storefront/src/features/local/components/DeliveryBadge.tsx`
- `frontend/storefront/src/features/local/components/DistanceFilter.tsx`
- `frontend/storefront/src/features/local/components/LocalSellerList.tsx`
- `frontend/storefront/src/features/local/components/LocationBar.tsx`
- `frontend/storefront/src/features/local/components/ProductGrid.tsx`
- `frontend/storefront/src/features/local/LocalPage.tsx`
- `frontend/storefront/src/features/local/query.ts`
- `frontend/storefront/src/features/local/seller-api.ts`
- `frontend/storefront/src/features/local/SellerDeliveryPage.tsx`
- `frontend/storefront/src/features/local/use-local-page.ts`
- `frontend/storefront/src/features/product/adapter.ts`
- `frontend/storefront/src/features/product/categoryConfig.ts`
- `frontend/storefront/src/features/product/components/BuyBox.tsx`
- `frontend/storefront/src/features/product/components/CategoryWidgets.tsx`
- `frontend/storefront/src/features/product/components/DescriptionBlocks.tsx`
- `frontend/storefront/src/features/product/components/HighlightsGrid.tsx`
- `frontend/storefront/src/features/product/components/OffersTabs.tsx`
- `frontend/storefront/src/features/product/components/PolicyCards.tsx`
- `frontend/storefront/src/features/product/components/PriceHistoryChart.tsx`
- `frontend/storefront/src/features/product/components/primitives.tsx`
- `frontend/storefront/src/features/product/components/ProductCarousel.tsx`
- `frontend/storefront/src/features/product/components/ProductGallery.tsx`
- `frontend/storefront/src/features/product/components/ProductSkeleton.tsx`
- `frontend/storefront/src/features/product/components/ProductSummaryBlock.tsx`
- `frontend/storefront/src/features/product/components/QnA.tsx`
- `frontend/storefront/src/features/product/components/QuantityStepper.tsx`
- `frontend/storefront/src/features/product/components/ReviewList.tsx`
- `frontend/storefront/src/features/product/components/ReviewSummary.tsx`
- `frontend/storefront/src/features/product/components/SectionRenderer.tsx`
- `frontend/storefront/src/features/product/components/SpecsAccordion.tsx`
- `frontend/storefront/src/features/product/components/VariantSelector.tsx`
- `frontend/storefront/src/features/product/data.ts`
- `frontend/storefront/src/features/product/helpers.ts`
- `frontend/storefront/src/features/product/MediaGallery.tsx`
- `frontend/storefront/src/features/product/mock/products.ts`
- `frontend/storefront/src/features/product/ProductDetailsPage.tsx`
- `frontend/storefront/src/features/product/ProductView.tsx`
- `frontend/storefront/src/features/product/server.ts`
- `frontend/storefront/src/features/product/types.ts`
- `frontend/storefront/src/features/search/NoResultsState.tsx`
- `frontend/storefront/src/features/search/query.ts`
- `frontend/storefront/src/features/search/SearchBar.tsx`
- `frontend/storefront/src/features/search/SearchPage.tsx`
- `frontend/storefront/src/features/search/SearchResultHeader.tsx`
- `frontend/storefront/src/features/search/use-search-results.ts`
- `frontend/storefront/src/features/sell/api.ts`
- `frontend/storefront/src/features/sell/index.ts`
- `frontend/storefront/src/features/sell/SellPage.tsx`
- `frontend/storefront/src/lib/http.ts`
- `frontend/storefront/src/lib/i18n/ar.ts`
- `frontend/storefront/src/lib/i18n/bn.ts`
- `frontend/storefront/src/lib/i18n/de.ts`
- `frontend/storefront/src/lib/i18n/dictionaries.ts`
- `frontend/storefront/src/lib/i18n/en.ts`
- `frontend/storefront/src/lib/i18n/es.ts`
- `frontend/storefront/src/lib/i18n/fr.ts`
- `frontend/storefront/src/lib/i18n/hi.ts`
- `frontend/storefront/src/lib/i18n/ja.ts`
- `frontend/storefront/src/lib/i18n/kn.ts`
- `frontend/storefront/src/lib/i18n/language-provider.tsx`
- `frontend/storefront/src/lib/i18n/languages.ts`
- `frontend/storefront/src/lib/i18n/ml.ts`
- `frontend/storefront/src/lib/i18n/mr.ts`
- `frontend/storefront/src/lib/i18n/pt.ts`
- `frontend/storefront/src/lib/i18n/ru.ts`
- `frontend/storefront/src/lib/i18n/ta.ts`
- `frontend/storefront/src/lib/i18n/te.ts`
- `frontend/storefront/src/lib/i18n/zh.ts`
- `frontend/storefront/src/lib/location.ts`
- `frontend/storefront/src/lib/markdown.tsx`
- `frontend/storefront/src/lib/phone.ts`
- `frontend/storefront/src/lib/site-config.server.ts`
- `frontend/storefront/src/lib/site-config.tsx`
- `frontend/storefront/src/lib/theme.ts`
- `frontend/storefront/src/lib/validation.ts`
- `frontend/storefront/src/middleware.ts`
- `frontend/storefront/src/types/assets.d.ts`
- `frontend/admin/src/app/(panel)/account/page.tsx`
- `frontend/admin/src/app/(panel)/audit-log/page.tsx`
- `frontend/admin/src/app/(panel)/catalog/attributes/page.tsx`
- `frontend/admin/src/app/(panel)/catalog/categories/page.tsx`
- `frontend/admin/src/app/(panel)/catalog/hsn/page.tsx`
- `frontend/admin/src/app/(panel)/catalog/products/page.tsx`
- `frontend/admin/src/app/(panel)/catalog/products/[id]/page.tsx`
- `frontend/admin/src/app/(panel)/customers/page.tsx`
- `frontend/admin/src/app/(panel)/customers/[id]/page.tsx`
- `frontend/admin/src/app/(panel)/layout.tsx`
- `frontend/admin/src/app/(panel)/marketing/banners/page.tsx`
- `frontend/admin/src/app/(panel)/marketing/coupons/page.tsx`
- `frontend/admin/src/app/(panel)/marketing/pages/page.tsx`
- `frontend/admin/src/app/(panel)/marketing/pages/[id]/page.tsx`
- `frontend/admin/src/app/(panel)/marketing/prime/page.tsx`
- `frontend/admin/src/app/(panel)/marketing/seo/page.tsx`
- `frontend/admin/src/app/(panel)/orders/page.tsx`
- `frontend/admin/src/app/(panel)/orders/[id]/page.tsx`
- `frontend/admin/src/app/(panel)/page.tsx`
- `frontend/admin/src/app/(panel)/settings/localisation/page.tsx`
- `frontend/admin/src/app/(panel)/settings/page.tsx`
- `frontend/admin/src/app/(panel)/settings/[group]/page.tsx`
- `frontend/admin/src/app/(panel)/staff/page.tsx`
- `frontend/admin/src/app/(panel)/staff/roles/page.tsx`
- `frontend/admin/src/app/(panel)/trust/reports/page.tsx`
- `frontend/admin/src/app/(panel)/trust/reviews/page.tsx`
- `frontend/admin/src/app/(panel)/vendors/kyc/page.tsx`
- `frontend/admin/src/app/(panel)/vendors/page.tsx`
- `frontend/admin/src/app/(panel)/vendors/[id]/page.tsx`
- `frontend/admin/src/app/layout.tsx`
- `frontend/admin/src/app/login/page.tsx`
- `frontend/admin/src/app/not-found.tsx`
- `frontend/admin/src/components/AppShell.tsx`
- `frontend/admin/src/components/BrandLogo.tsx`
- `frontend/admin/src/components/ImageField.tsx`
- `frontend/admin/src/components/ui.tsx`
- `frontend/admin/src/design-system/components/Alert/index.tsx`
- `frontend/admin/src/design-system/components/Button/index.tsx`
- `frontend/admin/src/design-system/components/Checkbox/index.tsx`
- `frontend/admin/src/design-system/components/Combobox/index.tsx`
- `frontend/admin/src/design-system/components/Dialog/index.tsx`
- `frontend/admin/src/design-system/components/Field.tsx`
- `frontend/admin/src/design-system/components/index.ts`
- `frontend/admin/src/design-system/components/ListSelect/index.tsx`
- `frontend/admin/src/design-system/components/MobileField/index.tsx`
- `frontend/admin/src/design-system/components/PasswordField/index.tsx`
- `frontend/admin/src/design-system/components/PhoneField/index.tsx`
- `frontend/admin/src/design-system/components/TextField/index.tsx`
- `frontend/admin/src/design-system/index.ts`
- `frontend/admin/src/design-system/styles/index.ts`
- `frontend/admin/src/design-system/tokens/colors.ts`
- `frontend/admin/src/design-system/tokens/index.ts`
- `frontend/admin/src/design-system/tokens/radius.ts`
- `frontend/admin/src/design-system/tokens/shadows.ts`
- `frontend/admin/src/design-system/tokens/spacing.ts`
- `frontend/admin/src/design-system/tokens/typography.ts`
- `frontend/admin/src/design-system/utils/cn.ts`
- `frontend/admin/src/features/account/AccountPage.tsx`
- `frontend/admin/src/features/auth/api.ts`
- `frontend/admin/src/features/auth/auth-provider.tsx`
- `frontend/admin/src/features/auth/LoginScreen.tsx`
- `frontend/admin/src/features/catalog/AttributesPage.tsx`
- `frontend/admin/src/features/catalog/CategoriesPage.tsx`
- `frontend/admin/src/features/catalog/HsnPage.tsx`
- `frontend/admin/src/features/catalog/ProductDetailPage.tsx`
- `frontend/admin/src/features/catalog/ProductsPage.tsx`
- `frontend/admin/src/features/customers/CustomerDetailPage.tsx`
- `frontend/admin/src/features/customers/CustomersList.tsx`
- `frontend/admin/src/features/dashboard/Dashboard.tsx`
- `frontend/admin/src/features/dashboard/SalesChart.tsx`
- `frontend/admin/src/features/marketing/BannersPage.tsx`
- `frontend/admin/src/features/marketing/CouponsPage.tsx`
- `frontend/admin/src/features/marketing/PageEditor.tsx`
- `frontend/admin/src/features/marketing/PagesList.tsx`
- `frontend/admin/src/features/marketing/PrimePage.tsx`
- `frontend/admin/src/features/marketing/SeoPage.tsx`
- `frontend/admin/src/features/orders/OrderDetailPage.tsx`
- `frontend/admin/src/features/orders/OrdersList.tsx`
- `frontend/admin/src/features/settings/BusinessRules.tsx`
- `frontend/admin/src/features/settings/FeaturesSettings.tsx`
- `frontend/admin/src/features/settings/LocalisationPage.tsx`
- `frontend/admin/src/features/settings/NotificationSettings.tsx`
- `frontend/admin/src/features/settings/PaymentsSettings.tsx`
- `frontend/admin/src/features/settings/RewardsSettings.tsx`
- `frontend/admin/src/features/settings/SettingsGroupPage.tsx`
- `frontend/admin/src/features/settings/SettingsIndex.tsx`
- `frontend/admin/src/features/settings/ShippingSettings.tsx`
- `frontend/admin/src/features/settings/TaxSettings.tsx`
- `frontend/admin/src/features/settings/ThemeSettings.tsx`
- `frontend/admin/src/features/staff/AuditLogPage.tsx`
- `frontend/admin/src/features/staff/RolesPage.tsx`
- `frontend/admin/src/features/staff/StaffPage.tsx`
- `frontend/admin/src/features/trust/ReportsPage.tsx`
- `frontend/admin/src/features/trust/ReviewModeration.tsx`
- `frontend/admin/src/features/vendors/DocumentViewer.tsx`
- `frontend/admin/src/features/vendors/KycQueue.tsx`
- `frontend/admin/src/features/vendors/types.ts`
- `frontend/admin/src/features/vendors/VendorDetailPage.tsx`
- `frontend/admin/src/features/vendors/VendorsList.tsx`
- `frontend/admin/src/lib/format.ts`
- `frontend/admin/src/lib/http.ts`
- `frontend/admin/src/lib/markdown.tsx`
- `frontend/admin/src/lib/phone.ts`
- `frontend/admin/src/lib/qr.ts`
- `frontend/admin/src/lib/site-config.server.ts`
- `frontend/admin/src/lib/site-config.tsx`
- `frontend/admin/src/lib/theme.ts`
- `frontend/admin/src/lib/use-api.ts`
- `frontend/admin/src/lib/validation.ts`
