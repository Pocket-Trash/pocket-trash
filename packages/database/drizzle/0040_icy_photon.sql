CREATE UNIQUE INDEX "color_name_case_insensitive_unique" ON "color" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "finish_name_case_insensitive_unique" ON "finish" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "makers_name_case_insensitive_unique" ON "makers" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "materials_name_case_insensitive_unique" ON "materials" USING btree (lower("name"));