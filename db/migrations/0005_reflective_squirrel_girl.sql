CREATE INDEX "cluster_meetings_meeting_idx" ON "cluster_meetings" USING btree ("meetingID");--> statement-breakpoint
CREATE INDEX "clusters_org_idx" ON "clusters" USING btree ("orgID");--> statement-breakpoint
CREATE INDEX "meeting_tags_tag_id_idx" ON "meeting_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "meeting_tags_meeting_id_idx" ON "meeting_tags" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meetings_org_idx" ON "meetings" USING btree ("org_id");