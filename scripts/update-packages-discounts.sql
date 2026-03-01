-- Migration script: Update package discounts and shareable flags
-- Run this after deploying the schema changes to production

-- 1. Energía Total (12 clases): 15% discount
UPDATE "Package"
SET "originalPrice" = 95.00,
    "discountPercent" = 15,
    price = 80.75
WHERE slug = 'energia-total-12';

-- 2. Full Access (24 clases): 10% discount
UPDATE "Package"
SET "originalPrice" = 145.00,
    "discountPercent" = 10,
    price = 130.50
WHERE slug = 'full-access-24';

-- 3. Wellnest Trimestral (80 clases): Shareable
UPDATE "Package"
SET "isShareable" = true,
    "maxShares" = 1
WHERE slug = 'wellnest-trimestral-80';
