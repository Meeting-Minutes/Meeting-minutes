ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_organization_id_team_id_pk";--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_organization_id_team_id_unique" UNIQUE("user_id","organization_id","team_id");