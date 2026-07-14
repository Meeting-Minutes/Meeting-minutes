CREATE TYPE "public"."minute_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "attendance" (
	"meeting_id" uuid,
	"user_id" uuid,
	CONSTRAINT "attendance_meeting_id_user_id_pk" PRIMARY KEY("meeting_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "cluster_meetings" (
	"clusterID" uuid,
	"meetingID" uuid,
	CONSTRAINT "cluster_meetings_clusterID_meetingID_pk" PRIMARY KEY("clusterID","meetingID")
);
--> statement-breakpoint
CREATE TABLE "clusters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgID" uuid,
	"name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "meeting_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"meeting_id" uuid,
	"tag_id" uuid
);
--> statement-breakpoint
CREATE TABLE "meeting_teams" (
	"meeting_id" uuid,
	"team_id" uuid,
	CONSTRAINT "meeting_teams_meeting_id_team_id_pk" PRIMARY KEY("meeting_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"template_id" uuid,
	"title" text NOT NULL,
	"continuation_of" uuid,
	"sheduled_at" timestamp NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_organization_id_team_id_pk" PRIMARY KEY("user_id","organization_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "minutes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"template_id" uuid,
	"status" "minute_status" DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "minutes_sections" (
	"minutes_id" uuid,
	"section_id" uuid,
	"content" jsonb NOT NULL,
	CONSTRAINT "minutes_sections_minutes_id_section_id_pk" PRIMARY KEY("minutes_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text,
	"description" text,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgID" uuid,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_team_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"template_id" uuid,
	"order" integer NOT NULL,
	"type" text,
	"title" text NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"orgId" uuid,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_meetings" ADD CONSTRAINT "cluster_meetings_clusterID_clusters_id_fk" FOREIGN KEY ("clusterID") REFERENCES "public"."clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_meetings" ADD CONSTRAINT "cluster_meetings_meetingID_meetings_id_fk" FOREIGN KEY ("meetingID") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_orgID_organizations_id_fk" FOREIGN KEY ("orgID") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_tags" ADD CONSTRAINT "meeting_tags_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_tags" ADD CONSTRAINT "meeting_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_teams" ADD CONSTRAINT "meeting_teams_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_teams" ADD CONSTRAINT "meeting_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_continuation_of_meetings_id_fk" FOREIGN KEY ("continuation_of") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_id_meetings_id_fk" FOREIGN KEY ("id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes" ADD CONSTRAINT "minutes_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD CONSTRAINT "minutes_sections_minutes_id_minutes_id_fk" FOREIGN KEY ("minutes_id") REFERENCES "public"."minutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minutes_sections" ADD CONSTRAINT "minutes_sections_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_orgID_organizations_id_fk" FOREIGN KEY ("orgID") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_fk" FOREIGN KEY ("parent_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_orgId_organizations_id_fk" FOREIGN KEY ("orgId") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;