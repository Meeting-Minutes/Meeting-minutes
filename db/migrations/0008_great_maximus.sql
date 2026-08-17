CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"minutes_id" uuid NOT NULL,
	"token" text NOT NULL,
	"email" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_minutes_id_minutes_id_fk" FOREIGN KEY ("minutes_id") REFERENCES "public"."minutes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;