CREATE TABLE "contact_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"source_conversation_id" text,
	"learned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_facts_key_uq" UNIQUE("contact_id","key")
);
--> statement-breakpoint
CREATE TABLE "conversation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"message_count" integer NOT NULL,
	"summary" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_sessions_start_uq" UNIQUE("conversation_id","started_at")
);
--> statement-breakpoint
CREATE TABLE "message_embeddings" (
	"message_id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"model" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_facts" ADD CONSTRAINT "contact_facts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_facts" ADD CONSTRAINT "contact_facts_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_sessions_conv_idx" ON "conversation_sessions" USING btree ("conversation_id","ended_at");--> statement-breakpoint
CREATE INDEX "message_embeddings_conv_idx" ON "message_embeddings" USING btree ("conversation_id");