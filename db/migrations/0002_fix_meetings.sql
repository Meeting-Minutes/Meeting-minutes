ALTER TABLE "meetings" RENAME COLUMN "sheduled_at" TO "scheduled_at";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "description" text;
