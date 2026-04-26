-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerWhatsapp" TEXT,
    "shippingName" TEXT NOT NULL,
    "shippingPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingProvince" TEXT NOT NULL,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT NOT NULL DEFAULT 'Cameroon',
    "billingName" TEXT,
    "billingPhone" TEXT,
    "billingAddress" TEXT,
    "billingCity" TEXT,
    "billingProvince" TEXT,
    "billingPostalCode" TEXT,
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "paymentId" TEXT,
    "paidAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "trackingNumber" TEXT,
    "shippingProvider" TEXT,
    "digitalDownloadUrl" TEXT,
    "digitalDownloadExpiry" DATETIME,
    "customerNotes" TEXT,
    "adminNotes" TEXT,
    "whatsappSentAt" DATETIME,
    "whatsappConfirmedAt" DATETIME,
    "couponId" TEXT,
    "couponCode" TEXT,
    "confirmedAt" DATETIME,
    "cancelledAt" DATETIME,
    "refundedAt" DATETIME,
    "completedAt" DATETIME,
    "lookupToken" TEXT,
    "lookupTokenExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("adminNotes", "billingAddress", "billingCity", "billingName", "billingPhone", "billingPostalCode", "billingProvince", "cancelledAt", "confirmedAt", "couponCode", "couponId", "createdAt", "currency", "customerEmail", "customerId", "customerName", "customerNotes", "customerPhone", "customerWhatsapp", "deliveredAt", "digitalDownloadExpiry", "digitalDownloadUrl", "discount", "id", "orderNumber", "paidAt", "paymentId", "paymentMethod", "paymentStatus", "refundedAt", "shippedAt", "shippingAddress", "shippingCity", "shippingCost", "shippingCountry", "shippingName", "shippingPhone", "shippingPostalCode", "shippingProvider", "shippingProvince", "status", "subtotal", "tax", "total", "trackingNumber", "updatedAt", "whatsappConfirmedAt", "whatsappSentAt") SELECT "adminNotes", "billingAddress", "billingCity", "billingName", "billingPhone", "billingPostalCode", "billingProvince", "cancelledAt", "confirmedAt", "couponCode", "couponId", "createdAt", "currency", "customerEmail", "customerId", "customerName", "customerNotes", "customerPhone", "customerWhatsapp", "deliveredAt", "digitalDownloadExpiry", "digitalDownloadUrl", "discount", "id", "orderNumber", "paidAt", "paymentId", "paymentMethod", "paymentStatus", "refundedAt", "shippedAt", "shippingAddress", "shippingCity", "shippingCost", "shippingCountry", "shippingName", "shippingPhone", "shippingPostalCode", "shippingProvider", "shippingProvince", "status", "subtotal", "tax", "total", "trackingNumber", "updatedAt", "whatsappConfirmedAt", "whatsappSentAt" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE UNIQUE INDEX "orders_lookupToken_key" ON "orders"("lookupToken");
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "orders_lookupToken_idx" ON "orders"("lookupToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
