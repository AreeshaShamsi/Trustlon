CREATE TABLE "store_banners" (
  "id" UUID NOT NULL,
  "vendor_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "subtitle" VARCHAR(240),
  "image_url" TEXT NOT NULL,
  "href" VARCHAR(300),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_banners_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "store_collections" (
  "id" UUID NOT NULL,
  "vendor_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(300),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "store_collections_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "store_collection_products" (
  "collection_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "store_collection_products_pkey" PRIMARY KEY ("collection_id", "product_id")
);
CREATE TABLE "store_follows" (
  "user_id" UUID NOT NULL,
  "vendor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_follows_pkey" PRIMARY KEY ("user_id", "vendor_id")
);
CREATE INDEX "store_banners_vendor_id_is_active_priority_idx" ON "store_banners"("vendor_id", "is_active", "priority");
CREATE INDEX "store_collections_vendor_id_is_active_sort_order_idx" ON "store_collections"("vendor_id", "is_active", "sort_order");
CREATE INDEX "store_collection_products_product_id_idx" ON "store_collection_products"("product_id");
CREATE INDEX "store_follows_vendor_id_idx" ON "store_follows"("vendor_id");
ALTER TABLE "store_banners" ADD CONSTRAINT "store_banners_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_collections" ADD CONSTRAINT "store_collections_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_collection_products" ADD CONSTRAINT "store_collection_products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "store_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_collection_products" ADD CONSTRAINT "store_collection_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
