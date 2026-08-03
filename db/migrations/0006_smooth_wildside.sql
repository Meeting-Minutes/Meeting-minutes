ALTER TABLE "minutes_sections" DROP CONSTRAINT "minutes_sections_section_id_template_sections_id_fk";
--> statement-breakpoint
ALTER TABLE "minutes_sections" DROP CONSTRAINT "minutes_sections_minutes_id_section_id_pk";--> statement-breakpoint
ALTER TABLE "minutes_sections" ALTER COLUMN "minutes_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD COLUMN "id" uuid PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD COLUMN "order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD COLUMN "config" jsonb;--> statement-breakpoint
CREATE INDEX "ms_minutes_idx" ON "minutes_sections" USING btree ("minutes_id");--> statement-breakpoint
ALTER TABLE "minutes_sections" DROP COLUMN "section_id";