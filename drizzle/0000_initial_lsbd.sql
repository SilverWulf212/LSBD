CREATE SCHEMA "lsbd";
--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."board_role" AS ENUM('president', 'vice_president', 'secretary_treasurer', 'member', 'hygienist_representative', 'consumer_member');--> statement-breakpoint
CREATE TYPE "public"."fee_category" AS ENUM('dentist', 'hygienist', 'miscellaneous');--> statement-breakpoint
CREATE TYPE "public"."meeting_doc_type" AS ENUM('notice', 'agenda', 'minutes');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "lsbd"."address_type" AS ENUM('home', 'office', 'permanent');--> statement-breakpoint
CREATE TYPE "lsbd"."license_class" AS ENUM('L', 'A', 'I', 'P', 'T', 'O', 'C', 'V', 'NL');--> statement-breakpoint
CREATE TYPE "lsbd"."license_status" AS ENUM('ACT', 'SUS', 'REV', 'REP', 'ARC', 'PRB', 'DEC', 'EXP', 'OTH', 'TMP', 'INA', 'RET', 'VOL');--> statement-breakpoint
CREATE TYPE "lsbd"."license_type" AS ENUM('D', 'H', 'E', 'O');--> statement-breakpoint
CREATE TYPE "lsbd"."inactive_reason" AS ENUM('Working In Other Field', 'Retired', 'Homemaker', 'Deceased', 'In Training in Occupation', 'Other', 'Semi-Retired');--> statement-breakpoint
CREATE TYPE "lsbd"."person_type" AS ENUM('D', 'H', 'E', 'O');--> statement-breakpoint
CREATE TYPE "lsbd"."report_type" AS ENUM('Cheshire', 'Avery 5160');--> statement-breakpoint
CREATE TYPE "lsbd"."specialty_code" AS ENUM('GENERAL', 'ENDO', 'Oral Pathology', 'Oral Surgery', 'ORTHO', 'PEDO', 'PERIO', 'PROSTHO', 'DPH', 'OMFS', 'NA');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" integer,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"honorific" varchar(50),
	"credential" varchar(100),
	"role" "board_role" DEFAULT 'member' NOT NULL,
	"district" varchar(50),
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloadable_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(200) NOT NULL,
	"blob_url" text,
	"blob_pathname" text,
	"file_size_bytes" integer,
	"is_external" boolean DEFAULT false NOT NULL,
	"external_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "fee_category" NOT NULL,
	"name" varchar(500) NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"doc_type" "meeting_doc_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"file_size_bytes" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"description" text,
	"meeting_type" varchar(100) DEFAULT 'board' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_slug" varchar(200) NOT NULL,
	"section_key" varchar(200) NOT NULL,
	"title" varchar(500),
	"content" text NOT NULL,
	"metadata" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"featured_image" text,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"year" integer NOT NULL,
	"description" text,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"file_size_bytes" integer,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"responsibilities" text,
	"phone" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "lsbd"."association_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"license_type" text,
	"associated_license_id" text,
	"associated_license_type" text,
	"operation_type" text,
	"updated_at" timestamp with time zone,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_closure" (
	"id" serial PRIMARY KEY NOT NULL,
	"closure" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_decision" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_hearing" (
	"id" serial PRIMARY KEY NOT NULL,
	"hearing" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_probation" (
	"id" serial PRIMARY KEY NOT NULL,
	"probation" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."compl_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."complaint" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_key" integer,
	"license_id" text,
	"log_no" text,
	"log_date" timestamp with time zone,
	"close_date" timestamp with time zone,
	"decision_date" timestamp with time zone,
	"last_visit" timestamp with time zone,
	"open" text,
	"status" text,
	"int_charge1" text,
	"int_charge2" text,
	"int_charge3" text,
	"charge_cat1" text,
	"charge_cat2" text,
	"charge_cat3" text,
	"charge1" text,
	"charge2" text,
	"charge3" text,
	"board_member" text,
	"investigator" text,
	"complainant" text,
	"hearing" text,
	"decision_type" text,
	"action" text,
	"susp_period" text,
	"susp_begin" timestamp with time zone,
	"susp_end" timestamp with time zone,
	"prob_period" text,
	"prob_begin" timestamp with time zone,
	"prob_end" timestamp with time zone,
	"ce_courses" text,
	"ce_area1" text,
	"ce_hours1" double precision,
	"ce_area2" text,
	"ce_hours2" double precision,
	"counseling" text,
	"comments" text,
	"attorney_name" text,
	"attorney_firm" text,
	"attorney_street1" text,
	"attorney_street2" text,
	"attorney_city" text,
	"attorney_state" text,
	"attorney_zip" text,
	"attorney_phone" text,
	"attorney_ext" text,
	"closure_terms" text,
	"probation_terms" text,
	"complainant_address1" text,
	"complainant_address2" text,
	"complainant_city" text,
	"complainant_state" text,
	"complainant_zip" text,
	"complainant_county" text,
	"complainant_phone" text,
	"complainant_ext" text,
	"complainant_fax" text,
	"license_type" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."disciplinary" (
	"disciplinary_id" uuid PRIMARY KEY NOT NULL,
	"individual_id" uuid,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone,
	"good_standing" boolean,
	"updated_by" uuid,
	"individual_legacy_id" integer,
	"legacy_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."disposition" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."individual" (
	"individual_id" uuid PRIMARY KEY NOT NULL,
	"last_name" text,
	"first_name" text,
	"middle_name" text,
	"married_name" text,
	"license_name" text,
	"suffix" text,
	"prefix" text,
	"use_license_name" boolean,
	"ssn" text,
	"dob" timestamp with time zone,
	"sex" text,
	"race" text,
	"email" text,
	"web_site" text,
	"processing_group" text,
	"notes" text,
	"updated_at" timestamp with time zone,
	"individual_status_uuid" uuid,
	"legacy_id" integer,
	"status" text,
	"indv_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."individual_affiliation" (
	"id" serial PRIMARY KEY NOT NULL,
	"individual_affiliation_uuid" uuid,
	"dentist_id" uuid,
	"individual_id" uuid,
	"dentist_legacy_id" integer,
	"individual_legacy_id" integer,
	"legacy_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."individual_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"individual_status_uuid" uuid,
	"status" text,
	"process_renewal" boolean,
	"legacy_id" integer,
	CONSTRAINT "individual_status_individual_status_uuid_unique" UNIQUE("individual_status_uuid")
);
--> statement-breakpoint
CREATE TABLE "lsbd"."license" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_key" integer,
	"license_id" text NOT NULL,
	"person_id" integer,
	"type" "lsbd"."license_type",
	"class" "lsbd"."license_class" DEFAULT 'L',
	"status" "lsbd"."license_status",
	"date_since" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"date_until" timestamp with time zone,
	"reg_year" text,
	"renew_month" text,
	"pa_number" text,
	"pllc_number" text,
	"permit_number" text,
	"processing_group" text,
	"is_current" boolean DEFAULT true,
	"audit" text,
	"action" text,
	"audit_year" text,
	"credential_exam" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."licensee_pii" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"ssn_hash" text,
	"dob" timestamp with time zone,
	"sex" text,
	"race" text,
	"background" boolean DEFAULT false,
	"password_hash" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."person" (
	"id" serial PRIMARY KEY NOT NULL,
	"individual_id" uuid,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"license_name" text,
	"married_name" text,
	"prefix" text,
	"suffix" text,
	"use_license_name" boolean DEFAULT false,
	"email" text,
	"url" text,
	"phone1" text,
	"ext1" text,
	"phone2" text,
	"ext2" text,
	"fax" text,
	"fax2" text,
	"opt_in" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."person_address" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"address_type" "lsbd"."address_type" NOT NULL,
	"line1" text,
	"line2" text,
	"line3" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"country" text,
	"legacy_addr_type" text,
	"address_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."person_education" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"school_name" text,
	"school_state" text,
	"grad_year" smallint,
	"degree" smallint
);
--> statement-breakpoint
CREATE TABLE "lsbd"."person_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"inactive_reason" text,
	"inactive2" boolean DEFAULT false,
	"individual_uuid" uuid,
	"individual_legacy_id" integer,
	"legacy_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."person_practice_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"hours_worked" double precision,
	"patients_per_week" double precision,
	"num_dentists" double precision,
	"num_hygienists" double precision,
	"num_da1" double precision,
	"num_da2" double precision,
	"satellite_city1" text,
	"satellite_city2" text,
	"ce_hours" double precision,
	"use_anesthesia" text,
	"use_sedation" text,
	"cs_none" boolean DEFAULT false,
	"cs_dispense" boolean DEFAULT false,
	"cs_administer" boolean DEFAULT false,
	"cpr" text,
	"ce_not_required" text,
	"complaint_flag" text,
	"limited_sup_dh" text,
	"formerly_employed" text,
	"principal_setting" text,
	"dea_number" text,
	"notes" text,
	"specialty" text,
	"location" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."professional" (
	"professional_id" uuid PRIMARY KEY NOT NULL,
	"professional_type_uuid" uuid,
	"practice_type_uuid" uuid,
	"individual_id" uuid,
	"license_number" text,
	"original_lic_issue_date" timestamp with time zone,
	"credential_exam" text,
	"audit_year" text,
	"updated_at" timestamp with time zone,
	"inactive" boolean,
	"cs_none" boolean,
	"cs_dispense" boolean,
	"cs_administer" boolean,
	"legacy_id" integer,
	"professional_type" text,
	"practice_type" text,
	"individual_legacy_id" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."as_permit" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_until" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"d_license_id" text,
	"other_dentists" text,
	"training" text,
	"train_year" text,
	"reg_year" text,
	"inspected_o" text,
	"inspected" text,
	"inspected_s1" text,
	"inspected_s2" text,
	"renew_month" text,
	"notes" text,
	"audit" text,
	"s_level" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."charge_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"charge_cat" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."charge_int" (
	"id" serial PRIMARY KEY NOT NULL,
	"int_charge" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."dent_exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_key" integer,
	"license_id" text,
	"prep_amal" numeric(6, 2),
	"rest_amal" numeric(6, 2),
	"prep_comp" numeric(6, 2),
	"rest_comp" numeric(6, 2),
	"endo" numeric(6, 2),
	"avg_lab" numeric(6, 2),
	"pros" numeric(6, 2),
	"perio" numeric(6, 2),
	"written" numeric(6, 2),
	"juris" numeric(6, 2),
	"sterile" numeric(6, 2),
	"grade" numeric(6, 2),
	"remarks" text,
	"nat_board_scores" boolean DEFAULT false,
	"den_hyg_school_trans" boolean DEFAULT false,
	"other_trans" boolean DEFAULT false,
	"photos" boolean DEFAULT false,
	"exam_fee" boolean DEFAULT false,
	"reco_letters" boolean DEFAULT false,
	"regis_letter" boolean DEFAULT false,
	"complete_appl" boolean DEFAULT false,
	"licensure_cert" boolean DEFAULT false,
	"insurance_verify" boolean DEFAULT false,
	"data_bank_rpt" boolean DEFAULT false,
	"recorded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."education" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer,
	"individual_id" integer,
	"den_hyg_id" integer,
	"education_type_id" integer,
	"school" text,
	"graduation_date" timestamp with time zone,
	"updated" timestamp with time zone,
	"school_state_id" integer,
	"board_certified" boolean,
	"certified_by" text,
	"certification_date" timestamp with time zone,
	"state" text,
	"edu_type" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."education_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"education_type" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."fee" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_code" text NOT NULL,
	"amount" numeric(19, 4),
	"description" text,
	CONSTRAINT "fee_fee_code_unique" UNIQUE("fee_code")
);
--> statement-breakpoint
CREATE TABLE "lsbd"."hyg_exam" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_key" integer,
	"license_id" text,
	"clinical" text,
	"juris" text,
	"sterile" text,
	"juris2" text,
	"sterile2" text,
	"pass_fail" text,
	"remarks" text,
	"nat_board_scores" boolean DEFAULT false,
	"den_hyg_school_trans" boolean DEFAULT false,
	"other_trans" boolean DEFAULT false,
	"photos" boolean DEFAULT false,
	"exam_fee" boolean DEFAULT false,
	"reco_letters" boolean DEFAULT false,
	"regis_letter" boolean DEFAULT false,
	"complete_appl" boolean DEFAULT false,
	"licensure_cert" boolean DEFAULT false,
	"insurance_verify" boolean DEFAULT false,
	"recorded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."inspection_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" integer,
	"individual_id" integer,
	"last_name" text,
	"first_name" text,
	"middle_name" text,
	"married_name" text,
	"license_name" text,
	"suffix" text,
	"prefix" text,
	"role" text,
	"a1" boolean,
	"a2" boolean,
	"a3" boolean,
	"a4" boolean,
	"a5" boolean,
	"a6" boolean,
	"a7" boolean,
	"a8" boolean,
	"a9" boolean
);
--> statement-breakpoint
CREATE TABLE "lsbd"."inspection_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_status" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"inspection_date" timestamp with time zone,
	"inspection_note" text,
	"score" integer,
	"d1" text,
	"d1_list" text,
	"d1_notes" text,
	"d2" text,
	"e1" text,
	"e1_notes" text,
	"inspector_id" integer,
	"inspection_status_id" integer,
	"address1" text,
	"address2" text,
	"address3" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"c1_list" text,
	"c1_notes" text,
	"c2" text,
	"c3" text,
	"c4" text,
	"e2" text,
	"e2_list" text,
	"e2_notes" text,
	"phone" text,
	"violations" text,
	"status" text,
	"inspector" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."permit_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" integer,
	"permit_type_name" text,
	"office_id" integer,
	"operation_type" text,
	"updated" timestamp with time zone,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."permit_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_type" text,
	"description" text,
	"personal_fee" numeric(19, 4),
	"office_fee" numeric(19, 4),
	"personal_priority" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."permits" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_type_id" integer,
	"dentist_id" integer,
	"office_id" integer,
	"permit_type_name" text,
	"permit_level" text,
	"description" text,
	"issue_date" timestamp with time zone,
	"updated" timestamp with time zone,
	"updated_online" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."professional_association" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"est_name" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"date_until" timestamp with time zone,
	"renew_month" text,
	"reg_year" text,
	"addr_name1" text,
	"addr_name2" text,
	"sort1" text,
	"sort2" text,
	"comment1" text,
	"comment2" text,
	"comment3" text,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"phone1" text,
	"ext1" text,
	"phone2" text,
	"ext2" text,
	"fax" text,
	"notes" text,
	"location" text,
	"email" text,
	"url" text,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."professional_llc" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"est_name" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"date_until" timestamp with time zone,
	"renew_month" text,
	"reg_year" text,
	"addr_name1" text,
	"addr_name2" text,
	"sort1" text,
	"sort2" text,
	"comment1" text,
	"comment2" text,
	"comment3" text,
	"address1" text,
	"address2" text,
	"address3" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"phone1" text,
	"ext1" text,
	"phone2" text,
	"ext2" text,
	"fax" text,
	"notes" text,
	"location" text,
	"email" text,
	"url" text,
	"type" text,
	"office_id" integer,
	"old_office_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."random_sample_anesthesia" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"d_license_id" text,
	"other_dentists" text,
	"training" text,
	"train_year" text,
	"date_until" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"reg_year" text,
	"inspected_o" text,
	"inspected" text,
	"inspected_s1" text,
	"inspected_s2" text,
	"renew_month" text,
	"notes" text,
	"audit" text,
	"s_level" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."random_sample_dentists" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"class" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"date_until" timestamp with time zone,
	"reg_year" text,
	"pa_no" text,
	"pllc_no" text,
	"permit_no" text,
	"first_name" text,
	"middle" text,
	"last_name" text,
	"dob" timestamp with time zone,
	"sex" text,
	"race" text,
	"specialty" text,
	"active" text,
	"inactive" text,
	"prin_set" text,
	"form_empl" text,
	"hrs_wk" double precision,
	"patient_cr" double precision,
	"num_dent" double precision,
	"num_hygen" double precision,
	"num_da1" double precision,
	"num_da2" double precision,
	"sat_city1" text,
	"sat_city2" text,
	"ce_hours" double precision,
	"use_anes" text,
	"use_sedat" text,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"addr_type" text,
	"complaint" text,
	"ssn" text,
	"email" text,
	"url" text,
	"location" text,
	"phone1" text,
	"ext1" text,
	"phone2" text,
	"ext2" text,
	"fax" text,
	"notes" text,
	"address_o1" text,
	"address_o2" text,
	"city_o" text,
	"state_o" text,
	"zip_o" text,
	"county_o" text,
	"o_addr_type" text,
	"sch_name" text,
	"sch_state" text,
	"grad_year" smallint,
	"degree" smallint,
	"renew_month" text,
	"address_p1" text,
	"address_p2" text,
	"city_p" text,
	"state_p" text,
	"zip_p" text,
	"county_p" text,
	"audit" text,
	"action" text,
	"background" boolean,
	"cpr" text,
	"ce_not_req" text,
	"fax2" text,
	"limited_sup_dh" text,
	"license_name" text,
	"married_name" text,
	"prefix" text,
	"suffix" text,
	"processing_group" text,
	"individual_legacy_id" integer,
	"individual_id" integer,
	"updated" timestamp with time zone,
	"legacy_id" integer,
	"use_license_name" boolean,
	"is_current" boolean,
	"address3" text,
	"country" text,
	"cs_none" boolean,
	"cs_dispense" boolean,
	"cs_administer" boolean,
	"audit_year" text,
	"credential_exam" text,
	"inactive_flag" boolean,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."random_sample_hygienists" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"class" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"date_until" timestamp with time zone,
	"reg_year" text,
	"pa_no" text,
	"pllc_no" text,
	"permit_no" text,
	"first_name" text,
	"middle" text,
	"last_name" text,
	"dob" timestamp with time zone,
	"sex" text,
	"race" text,
	"specialty" text,
	"active" text,
	"inactive" text,
	"prin_set" text,
	"form_empl" text,
	"hrs_wk" double precision,
	"patient_cr" double precision,
	"num_dent" double precision,
	"num_hygen" double precision,
	"num_da1" double precision,
	"num_da2" double precision,
	"sat_city1" text,
	"sat_city2" text,
	"ce_hours" double precision,
	"use_anes" text,
	"use_sedat" text,
	"address1" text,
	"address2" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"addr_type" text,
	"complaint" text,
	"ssn" text,
	"email" text,
	"url" text,
	"location" text,
	"phone1" text,
	"ext1" text,
	"phone2" text,
	"ext2" text,
	"fax" text,
	"notes" text,
	"address_o1" text,
	"address_o2" text,
	"city_o" text,
	"state_o" text,
	"zip_o" text,
	"county_o" text,
	"o_addr_type" text,
	"sch_name" text,
	"sch_state" text,
	"grad_year" smallint,
	"degree" smallint,
	"renew_month" text,
	"address_p1" text,
	"address_p2" text,
	"city_p" text,
	"state_p" text,
	"zip_p" text,
	"county_p" text,
	"audit" text,
	"action" text,
	"background" boolean,
	"cpr" text,
	"ce_not_req" text,
	"fax2" text,
	"limited_sup_dh" text,
	"license_name" text,
	"married_name" text,
	"prefix" text,
	"suffix" text,
	"processing_group" text,
	"individual_legacy_id" integer,
	"individual_id" integer,
	"updated" timestamp with time zone,
	"legacy_id" integer,
	"use_license_name" boolean,
	"is_current" boolean,
	"address3" text,
	"country" text,
	"cs_none" boolean,
	"cs_dispense" boolean,
	"cs_administer" boolean,
	"audit_year" text,
	"credential_exam" text,
	"inactive_flag" boolean,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."random_sample_sedation" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"status" text,
	"date_since" timestamp with time zone,
	"date_inactive" timestamp with time zone,
	"date_reinstate" timestamp with time zone,
	"d_license_id" text,
	"other_dentists" text,
	"training" text,
	"train_year" text,
	"date_until" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"date_renew" timestamp with time zone,
	"reg_year" text,
	"inspected_o" text,
	"inspected" text,
	"inspected_s1" text,
	"inspected_s2" text,
	"renew_month" text,
	"notes" text,
	"audit" text,
	"s_level" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."renewal_certification" (
	"id" serial PRIMARY KEY NOT NULL,
	"den_hyg_id" integer NOT NULL,
	"year" integer NOT NULL,
	"anes_incident" text,
	"convicted" text,
	"discipline" text,
	"ce" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."renewal_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"renewal_id" integer,
	"permit_id" integer,
	"printed" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."renewal_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_type" text NOT NULL,
	"expiration_date" timestamp with time zone NOT NULL,
	"renewal_date" timestamp with time zone NOT NULL,
	"fee" numeric(19, 4) NOT NULL,
	"well_being_fee" numeric(19, 4) NOT NULL,
	"late_fee" numeric(19, 4) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"late_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."renewals" (
	"id" serial PRIMARY KEY NOT NULL,
	"individual_id" integer,
	"app_printed" timestamp with time zone,
	"license_printed" timestamp with time zone,
	"renewal_amount" numeric(19, 4),
	"renewal_year" text,
	"transaction_date" timestamp with time zone,
	"last_update" timestamp with time zone,
	"amount_paid" numeric(19, 4),
	"p_permit_printed" timestamp with time zone,
	"o_permit_printed" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"sch_state" text,
	"sch_name" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."sed_level" (
	"id" serial PRIMARY KEY NOT NULL,
	"s_level" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."trans_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"trans_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."transaction_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer,
	"legacy_key" integer,
	"license_id" text,
	"name" text,
	"description" text,
	"ref_num" text,
	"fee" double precision,
	"type" text,
	"date_trans" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trans_ref" integer,
	"legacy_key" integer,
	"license_id" text,
	"name" text,
	"description" text,
	"date_deposit" timestamp with time zone,
	"renew_month" text,
	"exp_year" text,
	"ref_num" text,
	"deposit_no" text,
	"fee" double precision,
	"penalty" double precision,
	"total" double precision,
	"type" text,
	"ce_hours" double precision,
	"printed" boolean,
	"ass_fee" double precision,
	"date_renew" timestamp with time zone,
	"date_trans" timestamp with time zone,
	"issued" text,
	"date_stamp" timestamp with time zone,
	"time_stamp" text,
	"print_date" timestamp with time zone,
	"mail_date" timestamp with time zone,
	"app_printed" timestamp with time zone,
	"last_updated" timestamp with time zone,
	"o_permit_printed" timestamp with time zone,
	"p_permit_printed" timestamp with time zone,
	"renewal_id" integer,
	"individual_id" integer,
	"well_being_fee" double precision
);
--> statement-breakpoint
CREATE TABLE "lsbd"."activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"subject" text,
	"details" text,
	"updated" timestamp with time zone,
	"updated_by_uid" uuid,
	"attachment_url" text,
	"disciplinary_uid" uuid,
	"requires_review" boolean
);
--> statement-breakpoint
CREATE TABLE "lsbd"."address" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"link_uid" uuid,
	"address_1" text,
	"address_2" text,
	"address_3" text,
	"city_id" integer,
	"state_id" integer,
	"postal_code" text,
	"country_id" integer,
	"address_type_id" integer,
	"parish_id" integer,
	"is_current" boolean,
	"mailing" boolean,
	"updated" timestamp with time zone,
	"home" boolean,
	"flg_dup" boolean,
	"city_text" text,
	"state_text" text,
	"country_text" text,
	"individual_id" integer,
	"office_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."address_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"type" text,
	"first_name" text,
	"middle" text,
	"last_name" text,
	"address_1" text,
	"address_2" text,
	"city" text,
	"state" text,
	"zip" text,
	"county" text,
	"email" text,
	"address_o_1" text,
	"address_o_2" text,
	"city_o" text,
	"state_o" text,
	"zip_o" text,
	"county_o" text,
	"updated" timestamp with time zone,
	"updated_by" text,
	"opt_in" text,
	"deano" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."address_type_lookup" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"address_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"subject" text,
	"body" text,
	"expiration_date" timestamp with time zone,
	"active" boolean,
	"category_uid" uuid,
	"category_id" integer,
	"category_text" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"notes" text,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "lsbd"."board_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"full_name" text,
	"title" text,
	"address_1" text,
	"address_2" text,
	"display_order_override" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."category" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"description" text,
	"active" boolean,
	"cat_type" smallint
);
--> statement-breakpoint
CREATE TABLE "lsbd"."cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"city" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"country" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."election_districts" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"zip_code" text,
	"parish_id" integer,
	"district" smallint,
	"parish_name" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"question" text,
	"answer" text,
	"active" boolean,
	"category_uid" uuid,
	"category_id" integer,
	"category_text" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."logins" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text NOT NULL,
	"lic_type" text NOT NULL,
	"login_date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."office" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"office_name" text,
	"updated" timestamp with time zone,
	"old_office_id" integer,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."office_aff_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" text,
	"license_type" text,
	"office_id" integer,
	"operation_type" text,
	"updated" timestamp with time zone,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."office_affiliation" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"dentist_uid" uuid,
	"office_uid" uuid,
	"office_permit" boolean,
	"dentist_id" integer,
	"office_id" integer
);
--> statement-breakpoint
CREATE TABLE "lsbd"."parishes" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"parish" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."practice_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"practice_type" text,
	"specialty" boolean
);
--> statement-breakpoint
CREATE TABLE "lsbd"."professional_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"professional_type" text,
	"lics_code" text,
	"renewal_fee" numeric(19, 4),
	"late_fee" numeric(19, 4),
	"first_time_fee" numeric(19, 4)
);
--> statement-breakpoint
CREATE TABLE "lsbd"."specialty" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"professional_uid" uuid,
	"professional_id" integer,
	"institution" text,
	"specialty_date" timestamp with time zone,
	"board_certified" boolean,
	"certified_by" text,
	"certified_date" timestamp with time zone,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."states" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"state" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."statute_violations" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"disciplinary_uid" uuid,
	"disciplinary_id" integer,
	"statute_id" integer,
	"violation_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lsbd"."statutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"statute" text,
	"statute_title" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_class" (
	"id" serial PRIMARY KEY NOT NULL,
	"class" text NOT NULL,
	"class_desc" text,
	"login_ok" boolean DEFAULT false NOT NULL,
	"renew_ok" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_counties" (
	"id" serial PRIMARY KEY NOT NULL,
	"county" text,
	"county_name" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_form_empl" (
	"id" text PRIMARY KEY NOT NULL,
	"form_employ" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_inactive_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_prin_set" (
	"id" serial PRIMARY KEY NOT NULL,
	"prin_set" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_report_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_specialties" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_id" text NOT NULL,
	"status" text,
	"login_ok" boolean DEFAULT false NOT NULL,
	"renew_ok" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lsbd"."tbl_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"type_desc" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_uid" uuid,
	"user_name" text,
	"access_level" smallint,
	"email_address" text,
	"full_name" text,
	"sr_col_1_width" integer,
	"sr_col_2_width" integer,
	"inspector" boolean,
	"title" text,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."vs_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone,
	"amt" text,
	"acct" text,
	"exp_date" text,
	"card_holder" text,
	"street" text,
	"city" text,
	"state" text,
	"zip" text,
	"pnref" text NOT NULL,
	"result" text,
	"resp_msg" text,
	"auth_code" text,
	"avs_addr" text,
	"avs_zip" text,
	"lic_id" text,
	"lic_type" text,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."vs_capture" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_created" timestamp with time zone,
	"orig_id" text,
	"pnref" text NOT NULL,
	"result" text,
	"resp_msg" text,
	"auth_code" text,
	"avs_addr" text,
	"avs_zip" text
);
--> statement-breakpoint
CREATE TABLE "lsbd"."zipcodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"city" text,
	"state" text,
	"zip" text,
	"area_code" text,
	"county" text,
	"state_code" text,
	"time_zone" text,
	"longitude" text,
	"latitude" text
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_documents" ADD CONSTRAINT "meeting_documents_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."disciplinary" ADD CONSTRAINT "disciplinary_individual_id_individual_individual_id_fk" FOREIGN KEY ("individual_id") REFERENCES "lsbd"."individual"("individual_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."individual" ADD CONSTRAINT "individual_individual_status_uuid_individual_status_individual_status_uuid_fk" FOREIGN KEY ("individual_status_uuid") REFERENCES "lsbd"."individual_status"("individual_status_uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."individual_affiliation" ADD CONSTRAINT "individual_affiliation_dentist_id_individual_individual_id_fk" FOREIGN KEY ("dentist_id") REFERENCES "lsbd"."individual"("individual_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."individual_affiliation" ADD CONSTRAINT "individual_affiliation_individual_id_individual_individual_id_fk" FOREIGN KEY ("individual_id") REFERENCES "lsbd"."individual"("individual_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."license" ADD CONSTRAINT "license_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."licensee_pii" ADD CONSTRAINT "licensee_pii_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."person_address" ADD CONSTRAINT "person_address_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."person_education" ADD CONSTRAINT "person_education_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."person_meta" ADD CONSTRAINT "person_meta_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."person_practice_stats" ADD CONSTRAINT "person_practice_stats_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "lsbd"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."professional" ADD CONSTRAINT "professional_individual_id_individual_individual_id_fk" FOREIGN KEY ("individual_id") REFERENCES "lsbd"."individual"("individual_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."education" ADD CONSTRAINT "education_education_type_id_education_type_id_fk" FOREIGN KEY ("education_type_id") REFERENCES "lsbd"."education_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."inspection_details" ADD CONSTRAINT "inspection_details_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "lsbd"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."inspections" ADD CONSTRAINT "inspections_inspection_status_id_inspection_status_id_fk" FOREIGN KEY ("inspection_status_id") REFERENCES "lsbd"."inspection_status"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."renewal_details" ADD CONSTRAINT "renewal_details_renewal_id_renewals_id_fk" FOREIGN KEY ("renewal_id") REFERENCES "lsbd"."renewals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."renewal_details" ADD CONSTRAINT "renewal_details_permit_id_permits_id_fk" FOREIGN KEY ("permit_id") REFERENCES "lsbd"."permits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "lsbd"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lsbd"."transactions" ADD CONSTRAINT "transactions_renewal_id_renewals_id_fk" FOREIGN KEY ("renewal_id") REFERENCES "lsbd"."renewals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fees_category_idx" ON "fees" USING btree ("category");--> statement-breakpoint
CREATE INDEX "meeting_docs_meeting_id_idx" ON "meeting_documents" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meetings_date_idx" ON "meetings" USING btree ("meeting_date");--> statement-breakpoint
CREATE INDEX "page_sections_page_slug_idx" ON "page_sections" USING btree ("page_slug");--> statement-breakpoint
CREATE INDEX "page_sections_compound_idx" ON "page_sections" USING btree ("page_slug","section_key");--> statement-breakpoint
CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "posts_published_at_idx" ON "posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "assochist_license_idx" ON "lsbd"."association_history" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "assochist_associated_idx" ON "lsbd"."association_history" USING btree ("associated_license_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_action_action_idx" ON "lsbd"."compl_action" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_closure_closure_idx" ON "lsbd"."compl_closure" USING btree ("closure");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_decision_decision_idx" ON "lsbd"."compl_decision" USING btree ("decision");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_hearing_hearing_idx" ON "lsbd"."compl_hearing" USING btree ("hearing");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_probation_probation_idx" ON "lsbd"."compl_probation" USING btree ("probation");--> statement-breakpoint
CREATE UNIQUE INDEX "compl_status_code_idx" ON "lsbd"."compl_status" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "complaint_legacy_key_idx" ON "lsbd"."complaint" USING btree ("legacy_key");--> statement-breakpoint
CREATE INDEX "complaint_license_idx" ON "lsbd"."complaint" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "complaint_status_idx" ON "lsbd"."complaint" USING btree ("status");--> statement-breakpoint
CREATE INDEX "complaint_log_no_idx" ON "lsbd"."complaint" USING btree ("log_no");--> statement-breakpoint
CREATE INDEX "disciplinary_individual_idx" ON "lsbd"."disciplinary" USING btree ("individual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disposition_code_idx" ON "lsbd"."disposition" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "individual_indv_id_idx" ON "lsbd"."individual" USING btree ("indv_id");--> statement-breakpoint
CREATE INDEX "individual_last_name_idx" ON "lsbd"."individual" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "indaff_dentist_idx" ON "lsbd"."individual_affiliation" USING btree ("dentist_id");--> statement-breakpoint
CREATE INDEX "indaff_individual_idx" ON "lsbd"."individual_affiliation" USING btree ("individual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_license_id_idx" ON "lsbd"."license" USING btree ("license_id");--> statement-breakpoint
CREATE UNIQUE INDEX "license_legacy_key_idx" ON "lsbd"."license" USING btree ("legacy_key");--> statement-breakpoint
CREATE INDEX "license_status_idx" ON "lsbd"."license" USING btree ("status");--> statement-breakpoint
CREATE INDEX "license_type_idx" ON "lsbd"."license" USING btree ("type");--> statement-breakpoint
CREATE INDEX "license_person_idx" ON "lsbd"."license" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licensee_pii_person_idx" ON "lsbd"."licensee_pii" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_last_name_idx" ON "lsbd"."person" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "person_individual_idx" ON "lsbd"."person" USING btree ("individual_id");--> statement-breakpoint
CREATE INDEX "person_email_idx" ON "lsbd"."person" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "person_address_person_type_idx" ON "lsbd"."person_address" USING btree ("person_id","address_type");--> statement-breakpoint
CREATE INDEX "person_address_city_idx" ON "lsbd"."person_address" USING btree ("city");--> statement-breakpoint
CREATE INDEX "person_address_zip_idx" ON "lsbd"."person_address" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "professional_license_number_idx" ON "lsbd"."professional" USING btree ("license_number");--> statement-breakpoint
CREATE INDEX "professional_individual_idx" ON "lsbd"."professional" USING btree ("individual_id");--> statement-breakpoint
CREATE INDEX "address_individual_idx" ON "lsbd"."address" USING btree ("individual_id");--> statement-breakpoint
CREATE INDEX "address_office_idx" ON "lsbd"."address" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "logins_license_idx" ON "lsbd"."logins" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "logins_date_idx" ON "lsbd"."logins" USING btree ("login_date");--> statement-breakpoint
CREATE INDEX "office_affiliation_dentist_idx" ON "lsbd"."office_affiliation" USING btree ("dentist_id");--> statement-breakpoint
CREATE INDEX "office_affiliation_office_idx" ON "lsbd"."office_affiliation" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "vs_auth_pnref_idx" ON "lsbd"."vs_auth" USING btree ("pnref");--> statement-breakpoint
CREATE INDEX "vs_auth_lic_idx" ON "lsbd"."vs_auth" USING btree ("lic_id");--> statement-breakpoint
CREATE INDEX "vs_capture_pnref_idx" ON "lsbd"."vs_capture" USING btree ("pnref");--> statement-breakpoint
CREATE INDEX "vs_capture_orig_id_idx" ON "lsbd"."vs_capture" USING btree ("orig_id");--> statement-breakpoint
CREATE INDEX "zipcodes_zip_idx" ON "lsbd"."zipcodes" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "zipcodes_city_idx" ON "lsbd"."zipcodes" USING btree ("city");