## Schema

```
// This is your Prisma schema file for an Inventory Management System

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User management
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String
  password      String
  role          Role           @default(STAFF)
  active        Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  location      Location?      @relation(fields: [locationId], references: [id])
  locationId    String?
  purchaseOrders PurchaseOrder[] @relation("CreatedBy")
  salesOrders   SalesOrder[]   @relation("SalesCreatedBy")
  transfers     Transfer[]     @relation("TransferCreatedBy")
  adjustments   Adjustment[]   @relation("AdjustmentCreatedBy")
}

enum Role {
  ADMIN
  MANAGER
  STAFF
}

// Company locations (warehouses, shops, etc.)
model Location {
  id            String         @id @default(uuid())
  name          String
  type          LocationType
  address       String?
  phone         String?
  email         String?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  users         User[]
  inventories   Inventory[]
  incomingTransfers Transfer[] @relation("ToLocation")
  outgoingTransfers Transfer[] @relation("FromLocation")
  purchaseOrders PurchaseOrder[] @relation("DeliveryLocation")
  salesOrders   SalesOrder[]   @relation("SalesLocation")
}

enum LocationType {
  WAREHOUSE
  SHOP
  VIRTUAL
}

// Product categories
model Category {
  id            String         @id @default(uuid())
  name          String
  description   String?
  parentId      String?
  parent        Category?      @relation("SubCategories", fields: [parentId], references: [id])
  subCategories Category[]     @relation("SubCategories")
  items         Item[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// Suppliers/Vendors
model Supplier {
  id            String         @id @default(uuid())
  name          String
  contactPerson String?
  email         String?
  phone         String?
  address       String?
  taxId         String?
  paymentTerms  Int?           // Days
  notes         String?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  items         Item[]         @relation("SupplierItems")
  purchaseOrders PurchaseOrder[]
}

// Master item list
model Item {
  id            String         @id @default(uuid())
  name          String
  sku           String         @unique
  barcode       String?        @unique
  description   String?
  categoryId    String?
  category      Category?      @relation(fields: [categoryId], references: [id])
  unitOfMeasure String         @default("each")
  costPrice     Decimal        @default(0)
  sellingPrice  Decimal        @default(0)
  taxRate       Decimal        @default(0)
  minStockLevel Int            @default(0)
  maxStockLevel Int?
  isActive      Boolean        @default(true)
  isSerialTracked Boolean      @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  inventories   Inventory[]
  serialNumbers SerialNumber[]
  suppliers     Supplier[]     @relation("SupplierItems")
  purchaseOrderLines PurchaseOrderLine[]
  salesOrderLines SalesOrderLine[]
  transferLines  TransferLine[]
  adjustmentLines AdjustmentLine[]
}

// Location-specific inventory
model Inventory {
  id            String         @id @default(uuid())
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  locationId    String
  location      Location       @relation(fields: [locationId], references: [id])
  quantity      Int            @default(0)
  reservedQuantity Int         @default(0)
  lastCountDate DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@unique([itemId, locationId])
}

// Serial number tracking
model SerialNumber {
  id            String         @id @default(uuid())
  serialNumber  String         @unique
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  status        SerialStatus   @default(IN_STOCK)
  locationId    String?
  purchaseOrderId String?
  salesOrderId  String?
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum SerialStatus {
  IN_STOCK
  SOLD
  RESERVED
  DAMAGED
  RETURNED
}

// Purchase Orders
model PurchaseOrder {
  id            String         @id @default(uuid())
  poNumber      String         @unique
  supplierId    String
  supplier      Supplier       @relation(fields: [supplierId], references: [id])
  orderDate     DateTime       @default(now())
  expectedDate  DateTime?
  status        POStatus       @default(DRAFT)
  subtotal      Decimal        @default(0)
  taxAmount     Decimal        @default(0)
  totalAmount   Decimal        @default(0)
  notes         String?
  createdById   String
  createdBy     User           @relation("CreatedBy", fields: [createdById], references: [id])
  locationId    String
  location      Location       @relation("DeliveryLocation", fields: [locationId], references: [id])
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lines         PurchaseOrderLine[]
  receipts      GoodsReceipt[]
}

enum POStatus {
  DRAFT
  SUBMITTED
  APPROVED
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
}

model PurchaseOrderLine {
  id            String         @id @default(uuid())
  purchaseOrderId String
  purchaseOrder PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  quantity      Int
  receivedQuantity Int         @default(0)
  unitPrice     Decimal
  taxRate       Decimal        @default(0)
  lineTotal     Decimal
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  receiptLines  GoodsReceiptLine[]
}

// Goods Receipt (receiving against PO)
model GoodsReceipt {
  id            String         @id @default(uuid())
  receiptNumber String         @unique
  purchaseOrderId String
  purchaseOrder PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id])
  receiptDate   DateTime       @default(now())
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lines         GoodsReceiptLine[]
}

model GoodsReceiptLine {
  id            String         @id @default(uuid())
  goodsReceiptId String
  goodsReceipt  GoodsReceipt   @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  purchaseOrderLineId String
  purchaseOrderLine PurchaseOrderLine @relation(fields: [purchaseOrderLineId], references: [id])
  quantity      Int
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// Sales Orders (POS integration)
model SalesOrder {
  id            String         @id @default(uuid())
  orderNumber   String         @unique
  customerId    String?
  customerName  String?
  orderDate     DateTime       @default(now())
  status        SalesStatus    @default(DRAFT)
  subtotal      Decimal        @default(0)
  taxAmount     Decimal        @default(0)
  discountAmount Decimal       @default(0)
  totalAmount   Decimal        @default(0)
  notes         String?
  createdById   String
  createdBy     User           @relation("SalesCreatedBy", fields: [createdById], references: [id])
  locationId    String
  location      Location       @relation("SalesLocation", fields: [locationId], references: [id])
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lines         SalesOrderLine[]
}

enum SalesStatus {
  DRAFT
  COMPLETED
  CANCELLED
  RETURNED
}

model SalesOrderLine {
  id            String         @id @default(uuid())
  salesOrderId  String
  salesOrder    SalesOrder     @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  quantity      Int
  unitPrice     Decimal
  taxRate       Decimal        @default(0)
  discount      Decimal        @default(0)
  lineTotal     Decimal
  serialNumbers String?        // Comma-separated serial numbers
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// Inventory Transfers between locations
model Transfer {
  id            String         @id @default(uuid())
  transferNumber String        @unique
  fromLocationId String
  fromLocation  Location       @relation("FromLocation", fields: [fromLocationId], references: [id])
  toLocationId  String
  toLocation    Location       @relation("ToLocation", fields: [toLocationId], references: [id])
  transferDate  DateTime       @default(now())
  status        TransferStatus @default(DRAFT)
  notes         String?
  createdById   String
  createdBy     User           @relation("TransferCreatedBy", fields: [createdById], references: [id])
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lines         TransferLine[]
}

enum TransferStatus {
  DRAFT
  IN_TRANSIT
  COMPLETED
  CANCELLED
}

model TransferLine {
  id            String         @id @default(uuid())
  transferId    String
  transfer      Transfer       @relation(fields: [transferId], references: [id], onDelete: Cascade)
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  quantity      Int
  serialNumbers String?        // Comma-separated serial numbers
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

// Inventory Adjustments
model Adjustment {
  id            String         @id @default(uuid())
  adjustmentNumber String      @unique
  locationId    String
  adjustmentDate DateTime      @default(now())
  reason        String
  notes         String?
  createdById   String
  createdBy     User           @relation("AdjustmentCreatedBy", fields: [createdById], references: [id])
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  lines         AdjustmentLine[]
}

model AdjustmentLine {
  id            String         @id @default(uuid())
  adjustmentId  String
  adjustment    Adjustment     @relation(fields: [adjustmentId], references: [id], onDelete: Cascade)
  itemId        String
  item          Item           @relation(fields: [itemId], references: [id])
  quantityBefore Int
  quantityAfter Int
  serialNumbers String?        // Comma-separated serial numbers
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```
