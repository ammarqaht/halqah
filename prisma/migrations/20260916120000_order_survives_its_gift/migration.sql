-- An order must outlive the shelf it was bought from.
--
-- `orders.gift_id` was NOT NULL with a required reference to `gifts`. Deleting
-- a gift that had ever been bought therefore raised a foreign-key violation on
-- the next save — and because the whole save runs in one transaction, NOTHING
-- was written: not the deletion, not the points, not the exams entered in the
-- same sitting. The screen reported a failed save and gave no reason.
--
-- The order already snapshots the gift's name and price, which is what it
-- needs to stay truthful. So the link is made optional and severed on delete
-- rather than cascading — cascading would take the purchase with the product.

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_gift_id_fkey";

ALTER TABLE "orders" ALTER COLUMN "gift_id" DROP NOT NULL;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_gift_id_fkey"
  FOREIGN KEY ("gift_id") REFERENCES "gifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
