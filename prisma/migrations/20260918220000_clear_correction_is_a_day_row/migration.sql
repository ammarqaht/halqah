-- «مسح تسجيل اليوم» is a TEACHER row — 18 Sep 2026.
--
-- The correction written when a teacher clears a day dropped its `ref_type`
-- along with its `ref_id`. Only the id had to go; the type is what marks a row
-- as the teacher portal's own, and `PUT /api/state` keeps exactly those and
-- rewrites every other row from the supervisor's browser.
--
-- Without it the row survived the delete (SQL says UNKNOWN, not TRUE, when it
-- compares NULL to 'day') and came back in the incoming list — so the insert
-- collided with the row it had just failed to delete, and the whole save
-- returned 500. After any «امسح تسجيله», the supervisor could never save again.
--
-- The code no longer writes them that way. These are the ones already written:
-- only the clear path ever mints this id shape, so the match is exact.

UPDATE "point_txns"
   SET "ref_type" = 'day'
 WHERE "ref_type" IS NULL
   AND "id" LIKE 'day-%-clear-%';
