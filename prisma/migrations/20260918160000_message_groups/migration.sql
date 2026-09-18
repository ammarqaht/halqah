-- إرسالة واحدة، مهما كتبت من صفوف — 18 Sep 2026.
--
-- «بلوك ما أُرسل يظهر كل رسالة في بطاقة وحدة ومعها لمن أُرسلت هذه الرسالة، وليس
--  كل شخص في بطاقة لوحده» (client).
--
-- Addressing stays a row per reader — that is what makes each copy tickable on
-- its own — and `group_id` is what puts the rows back together for the person
-- who wrote them. `scope_label` records HOW the readers were chosen, stored
-- rather than derived: a boy who has since left a halaqa would otherwise make
-- an old send describe itself wrongly.

-- AlterTable
ALTER TABLE "admin_messages" ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "scope_label" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "admin_messages_group_id_idx" ON "admin_messages"("group_id");

