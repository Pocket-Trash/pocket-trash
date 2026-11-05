CREATE TABLE "pen_actuator_mechanism" (
	"actuator_product_id" bigint,
	"mechanism_product_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pen_actuator_mechanism_pkey" PRIMARY KEY("actuator_product_id","mechanism_product_id"),
	CONSTRAINT "pen_actuator_mechanism_distinct" CHECK ("actuator_product_id" <> "mechanism_product_id")
);
--> statement-breakpoint
CREATE INDEX "pen_actuator_mechanism_reverse_idx" ON "pen_actuator_mechanism" ("mechanism_product_id");--> statement-breakpoint
ALTER TABLE "pen_actuator_mechanism" ADD CONSTRAINT "pen_actuator_mechanism_AwnN81Q3CEFJ_fkey" FOREIGN KEY ("actuator_product_id") REFERENCES "product_detail_pen_part"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "pen_actuator_mechanism" ADD CONSTRAINT "pen_actuator_mechanism_u70ck1vADs3R_fkey" FOREIGN KEY ("mechanism_product_id") REFERENCES "product_detail_pen_mechanism"("id") ON DELETE RESTRICT;