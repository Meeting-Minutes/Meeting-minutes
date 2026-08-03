ALTER TABLE "minutes_sections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "template_sections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "minutes_sections" CASCADE;--> statement-breakpoint
DROP TABLE "template_sections" CASCADE;--> statement-breakpoint
ALTER TABLE "templates" DROP CONSTRAINT "templates_orgId_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "minutes" ADD COLUMN "content" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "tex_path" text;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "templates_org_idx" ON "templates" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "orgId";