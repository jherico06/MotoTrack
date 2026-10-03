-- MotoTrack public schema snapshot
-- Generated for ERD tools (drawSQL, dbdiagram, DBeaver, etc.)
-- Source: Supabase project vtbdmurblidtdghaotne
-- Generated at: 2026-09-27T15:50:43.384Z
-- Tables: 50

CREATE SCHEMA IF NOT EXISTS "public";

-- RLS enabled: true
CREATE TABLE "public"."users" (
  "user_id" text NOT NULL DEFAULT ('usr-'::text || substr(md5((random())::text), 1, 12)),
  "id" text DEFAULT user_id,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password" text NOT NULL,
  "role" text NOT NULL DEFAULT 'user'::text,
  "status" text NOT NULL DEFAULT 'active'::text,
  "phone" text,
  "address" text,
  "avatar" text,
  "member_since" text DEFAULT '2026'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "username" text,
  PRIMARY KEY ("user_id")
);

-- RLS enabled: true
CREATE TABLE "public"."customers" (
  "customer_id" text NOT NULL DEFAULT ('cust-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "contact_number" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("customer_id")
);

-- RLS enabled: true
CREATE TABLE "public"."addresses" (
  "address_id" text NOT NULL DEFAULT ('addr-'::text || substr(md5((random())::text), 1, 12)),
  "customer_id" text,
  "label" text DEFAULT 'Home'::text,
  "full_address" text NOT NULL,
  "city" text,
  "province" text,
  "zip_code" text,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "latitude" double precision,
  "longitude" double precision,
  "landmark" text,
  PRIMARY KEY ("address_id")
);

-- RLS enabled: true
CREATE TABLE "public"."notifications" (
  "notification_id" text NOT NULL DEFAULT ('notif-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text,
  "message" text NOT NULL,
  "type" text DEFAULT 'info'::text,
  "status" text DEFAULT 'unread'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("notification_id")
);

-- RLS enabled: true
CREATE TABLE "public"."suppliers" (
  "supplier_id" text NOT NULL DEFAULT ('sup-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "contact_person" text,
  "phone" text,
  "address" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("supplier_id")
);

-- RLS enabled: true
CREATE TABLE "public"."categories" (
  "category_id" text NOT NULL DEFAULT ('cat-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("category_id")
);

-- RLS enabled: true
CREATE TABLE "public"."products" (
  "product_id" text NOT NULL,
  "id" text DEFAULT product_id,
  "supplier_id" text,
  "category_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric NOT NULL,
  "cost_price" numeric,
  "image" text,
  "status" text DEFAULT 'active'::text,
  "brand" text,
  "old_price" numeric,
  "rating" numeric DEFAULT 0,
  "reviews" integer DEFAULT 0,
  "compatibility" text,
  "sku" text,
  "badge" text,
  "type" text DEFAULT 'newArrival'::text,
  "is_new" boolean DEFAULT false,
  "discount" text,
  "material" text,
  "weight" text,
  "features" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "unit_cost" numeric DEFAULT 0,
  "sizes" jsonb DEFAULT '[]'::jsonb,
  "colors" jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY ("product_id")
);

-- RLS enabled: true
CREATE TABLE "public"."inventory" (
  "inventory_id" text NOT NULL DEFAULT ('inv-'::text || substr(md5((random())::text), 1, 12)),
  "product_id" text UNIQUE,
  "stock_quantity" integer NOT NULL DEFAULT 0,
  "reorder_level" integer DEFAULT 5,
  "last_updated" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("inventory_id")
);

-- RLS enabled: true
CREATE TABLE "public"."discounts" (
  "discount_id" text NOT NULL DEFAULT ('disc-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'percentage'::text,
  "value" numeric NOT NULL,
  "start_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "end_date" timestamp with time zone,
  "min_purchase" numeric DEFAULT 0,
  "status" text DEFAULT 'active'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("discount_id")
);

-- RLS enabled: true
CREATE TABLE "public"."promos" (
  "promo_id" text NOT NULL DEFAULT ('prm-'::text || substr(md5((random())::text), 1, 12)),
  "discount_id" text,
  "code" text NOT NULL UNIQUE,
  "discount_percent" integer DEFAULT 20,
  "description" text,
  "usage_limit" integer DEFAULT 100,
  "used_count" integer DEFAULT 0,
  "status" text DEFAULT 'active'::text,
  "is_active" boolean DEFAULT true,
  "start_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "end_date" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("promo_id")
);

-- RLS enabled: true
CREATE TABLE "public"."orders" (
  "order_id" text NOT NULL DEFAULT ('ord-'::text || substr(md5((random())::text), 1, 12)),
  "customer_id" text,
  "address_id" text,
  "promo_id" text,
  "order_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "status" text DEFAULT 'Processing'::text,
  "total_amount" numeric NOT NULL DEFAULT 0,
  "discount_amount" numeric DEFAULT 0,
  "grand_total" numeric NOT NULL DEFAULT 0,
  "customer_name" text,
  "customer_phone" text,
  "customer_address" text,
  "payment_method" text DEFAULT 'Credit Card'::text,
  "items_summary" text,
  "items_count" integer DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "channel" text DEFAULT 'Online Store'::text,
  "delivery_notes" text,
  "tracking_number" text,
  "courier" text DEFAULT 'MotoTrack Express SuperAir'::text,
  "estimated_delivery" text,
  "cod_change_for" text,
  "cancel_reason" text,
  "return_status" text DEFAULT 'none'::text,
  "return_reason" text,
  "return_notes" text,
  "return_requested_at" timestamp with time zone,
  "shipping_fee" numeric DEFAULT 0,
  "delivery_lat" double precision,
  "delivery_lng" double precision,
  "delivery_landmark" text,
  "delivered_at" timestamp with time zone,
  "delivered_by_rider_id" text,
  PRIMARY KEY ("order_id")
);

-- RLS enabled: true
CREATE TABLE "public"."order_items" (
  "order_item_id" text NOT NULL DEFAULT ('oi-'::text || substr(md5((random())::text), 1, 12)),
  "order_id" text,
  "product_id" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "cost" numeric DEFAULT 0,
  "subtotal" numeric NOT NULL DEFAULT 0,
  "unit_cost" numeric,
  "size" text,
  PRIMARY KEY ("order_item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."payments" (
  "payment_id" text NOT NULL DEFAULT ('pay-'::text || substr(md5((random())::text), 1, 12)),
  "order_id" text,
  "payment_method" text NOT NULL,
  "amount" numeric NOT NULL,
  "reference_number" text,
  "payment_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "status" text DEFAULT 'Completed'::text,
  "booking_id" text,
  "customer_id" text,
  "payment_type" text,
  "transaction_reference" text,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("payment_id")
);

-- RLS enabled: true
CREATE TABLE "public"."sales" (
  "sale_id" text NOT NULL DEFAULT ('sale-'::text || substr(md5((random())::text), 1, 12)),
  "customer_id" text,
  "payment_id" text,
  "sale_type" text DEFAULT 'Online'::text,
  "total_amount" numeric NOT NULL DEFAULT 0,
  "amount_paid" numeric NOT NULL DEFAULT 0,
  "change" numeric DEFAULT 0,
  "sale_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("sale_id")
);

-- RLS enabled: true
CREATE TABLE "public"."sale_items" (
  "sale_item_id" text NOT NULL DEFAULT ('si-'::text || substr(md5((random())::text), 1, 12)),
  "sale_id" text,
  "product_id" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "price" numeric NOT NULL DEFAULT 0,
  "subtotal" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("sale_item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."carts" (
  "cart_id" text NOT NULL DEFAULT ('cart-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("cart_id")
);

-- RLS enabled: true
CREATE TABLE "public"."cart_items" (
  "cart_item_id" text NOT NULL DEFAULT ('ci-'::text || substr(md5((random())::text), 1, 12)),
  "cart_id" text,
  "product_id" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "subtotal" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("cart_item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."services" (
  "service_id" text NOT NULL DEFAULT ('srv-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "category" text,
  "price" numeric NOT NULL DEFAULT 0,
  "duration" text DEFAULT '60 min'::text,
  "status" text DEFAULT 'active'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "description" text,
  "image" text,
  "subtitle" text,
  "badge" text,
  "inclusions" jsonb DEFAULT '[]'::jsonb,
  "price_php" numeric,
  "parts_cost" numeric DEFAULT 0,
  "materials_cost" numeric DEFAULT 0,
  "technician_cost" numeric DEFAULT 0,
  "other_cost" numeric DEFAULT 0,
  PRIMARY KEY ("service_id")
);

-- RLS enabled: true
CREATE TABLE "public"."bookings" (
  "booking_id" text NOT NULL DEFAULT ('bk-'::text || substr(md5((random())::text), 1, 12)),
  "customer_id" text,
  "service_id" text,
  "schedule" timestamp with time zone NOT NULL,
  "previous_schedule" timestamp with time zone,
  "rescheduled_at" timestamp with time zone,
  "notes" text,
  "status" text DEFAULT 'Pending'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "bike_brand" text,
  "bike_model" text,
  "bike_plate" text,
  "bike_odo" text,
  "branch_name" text,
  "customer_name" text,
  "customer_phone" text,
  "price" numeric,
  "mechanic_id" text,
  "downpayment_amount" numeric,
  "downpayment_ref" text,
  "downpayment_paid_at" timestamp with time zone,
  "downpayment_method" text,
  "remaining_balance" numeric,
  "service_progress" integer DEFAULT 0,
  "current_stage" text,
  "estimate_amount" numeric,
  "estimate_notes" text,
  "additional_estimates" jsonb DEFAULT '[]'::jsonb,
  "category" text,
  "time_slot" text,
  "appointment_date" text,
  "repair_type" text,
  "user_id" text,
  "total_price_with_estimates" numeric,
  "inspection_notes" text,
  "inspection_started_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "quality_checked_at" timestamp with time zone,
  "quality_checked_by" text,
  "rejection_reason" text,
  "package_id" text,
  "package_name" text,
  "package_price" numeric,
  "included_services" jsonb DEFAULT '[]'::jsonb,
  "estimated_duration" text,
  "bike_year" text,
  "motorcycle_photo" text,
  "suggested_date" text,
  "suggested_time" text,
  "additional_charges" numeric DEFAULT 0,
  "additional_charges_notes" text,
  "service_notes" text,
  "mechanic" text,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  "service_title" text,
  "parts_cost" numeric,
  "materials_cost" numeric,
  "technician_cost" numeric,
  "other_cost" numeric,
  "total_service_cost" numeric,
  "booking_mode" text DEFAULT 'flexible'::text,
  "problem_description" text,
  "media_urls" jsonb DEFAULT '[]'::jsonb,
  "motorcycle_id" text,
  "preferred_date" text,
  "preferred_time" text,
  "service_type" text,
  "admin_notes" text,
  "rejection_notes" text,
  "info_request_notes" text,
  "estimated_labor_hours" numeric,
  "actual_labor_hours" numeric,
  "quoted_hourly_rate" numeric,
  "estimated_labor_cost" numeric,
  "actual_labor_cost" numeric,
  "parts_total" numeric DEFAULT 0,
  "other_charges_total" numeric DEFAULT 0,
  "discount_amount" numeric DEFAULT 0,
  "discount_type" text,
  "discount_value" numeric DEFAULT 0,
  "estimated_service_total" numeric,
  "final_service_total" numeric,
  "downpayment_percent" numeric,
  "downpayment_type" text DEFAULT 'percent'::text,
  "downpayment_status" text DEFAULT 'Not Required'::text,
  "amount_paid" numeric DEFAULT 0,
  "payment_status" text DEFAULT 'Unpaid'::text,
  "active_quotation_id" text,
  "service_started_at" timestamp with time zone,
  "service_completed_at" timestamp with time zone,
  "pickup_qr_token" text,
  "pickup_qr_expires_at" timestamp with time zone,
  "pickup_verified_at" timestamp with time zone,
  "pickup_released_by" text,
  "plate_number" text,
  "odometer" text,
  "branch" text,
  "service_price" numeric,
  "price_php" numeric,
  "mechanic_assigned_at" timestamp with time zone,
  "mechanic_assignment_status" text,
  "customer_email" text,
  "customer_address" text,
  "bike_color" text,
  "priority" text DEFAULT 'Normal'::text,
  PRIMARY KEY ("booking_id")
);

-- RLS enabled: true
CREATE TABLE "public"."purchase_orders" (
  "po_id" text NOT NULL DEFAULT ('po-'::text || substr(md5((random())::text), 1, 12)),
  "supplier_id" text,
  "order_date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "status" text DEFAULT 'Completed'::text,
  "total_amount" numeric NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("po_id")
);

-- RLS enabled: true
CREATE TABLE "public"."purchase_items" (
  "purchase_item_id" text NOT NULL DEFAULT ('pi-'::text || substr(md5((random())::text), 1, 12)),
  "po_id" text,
  "product_id" text,
  "quantity" integer NOT NULL DEFAULT 1,
  "cost" numeric NOT NULL DEFAULT 0,
  "subtotal" numeric NOT NULL DEFAULT 0,
  PRIMARY KEY ("purchase_item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."backups" (
  "backup_id" text NOT NULL DEFAULT ('bkp-'::text || substr(md5((random())::text), 1, 12)),
  "date" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "file_path" text NOT NULL,
  PRIMARY KEY ("backup_id")
);

-- RLS enabled: true
CREATE TABLE "public"."system_settings" (
  "settings_id" text NOT NULL DEFAULT ('set-'::text || substr(md5((random())::text), 1, 12)),
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("settings_id")
);

-- RLS enabled: true
CREATE TABLE "public"."otp_verifications" (
  "id" text NOT NULL DEFAULT ('otp-'::text || substr(md5((random())::text), 1, 12)),
  "email" text NOT NULL,
  "otp_code" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified" boolean DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("id")
);

-- RLS enabled: true
CREATE TABLE "public"."admin_pins" (
  "pin_id" text NOT NULL DEFAULT ('pin-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text NOT NULL UNIQUE,
  "pin" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("pin_id")
);

-- RLS enabled: true
CREATE TABLE "public"."order_notes" (
  "note_id" text NOT NULL DEFAULT ('not-'::text || substr(md5((random())::text), 1, 12)),
  "order_id" text,
  "note_type" text DEFAULT 'cancellation'::text,
  "content" text NOT NULL,
  "author" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("note_id")
);

-- RLS enabled: true
CREATE TABLE "public"."account_logs" (
  "log_id" text NOT NULL DEFAULT ('log-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text,
  "action" text NOT NULL,
  "description" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "ip_address" text DEFAULT '127.0.0.1'::text,
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("log_id")
);

-- RLS enabled: true
CREATE TABLE "public"."customer_motorcycles" (
  "motorcycle_id" text NOT NULL DEFAULT ('moto-'::text || substr(md5((random())::text), 1, 12)),
  "user_id" text,
  "customer_id" text,
  "brand" text NOT NULL,
  "model" text NOT NULL,
  "year" integer,
  "plate_number" text NOT NULL,
  "engine_cc" integer,
  "color" text,
  "odometer" text,
  "vin_number" text,
  "nickname" text,
  "photo_url" text,
  "is_primary" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "customer_email" text,
  PRIMARY KEY ("motorcycle_id")
);

-- RLS enabled: true
CREATE TABLE "public"."mechanics" (
  "id" text NOT NULL DEFAULT ('tech-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "short_name" text,
  "specialization" text DEFAULT 'Engine Overhaul & Diagnostics'::text,
  "experience" text DEFAULT '5 Years Pro Tech'::text,
  "certifications" text DEFAULT 'Certified Motorcycle Technician'::text,
  "avatar" text DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'::text,
  "bay" text DEFAULT 'Bay 1 (Master Diagnostic Cell)'::text,
  "status" text NOT NULL DEFAULT 'Available'::text,
  "phone" text,
  "email" text,
  "rating" numeric DEFAULT 5.0,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "hourly_rate" numeric NOT NULL DEFAULT 150.00,
  "is_active" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id")
);

-- RLS enabled: true
CREATE TABLE "public"."order_deliveries" (
  "delivery_id" text NOT NULL DEFAULT ('del-'::text || substr(md5((random())::text), 1, 12)),
  "order_id" text NOT NULL UNIQUE,
  "delivery_notes" text,
  "delivery_status" text DEFAULT 'Ready for Delivery'::text,
  "expected_delivery_at" timestamp with time zone,
  "otp_hash" text,
  "otp_expires_at" timestamp with time zone,
  "otp_verified" boolean DEFAULT false,
  "otp_verified_at" timestamp with time zone,
  "customer_confirmed" boolean DEFAULT false,
  "customer_confirmed_at" timestamp with time zone,
  "confirmed_by_customer_id" text,
  "proof_of_delivery" text,
  "proof_uploaded_by" text,
  "proof_uploaded_at" timestamp with time zone,
  "assigned_by" text,
  "assigned_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "rider_id" text,
  "rider_reported_delivered" boolean DEFAULT false,
  "rider_reported_at" timestamp with time zone,
  "rider_reported_by" text,
  "rider_report_notes" text,
  "admin_confirmed" boolean DEFAULT false,
  "admin_confirmed_at" timestamp with time zone,
  "admin_confirmed_reason" text,
  "confirmed_by_admin" text,
  "rider_name" text,
  "rider_contact" text,
  "vehicle_info" text,
  "confirmation_token_hash" text,
  "confirmation_token_expires_at" timestamp with time zone,
  "confirmation_token_used_at" timestamp with time zone,
  "confirmation_token_invalidated_at" timestamp with time zone,
  "confirmation_token_created_at" timestamp with time zone,
  "token_verified" boolean DEFAULT false,
  "delivery_photo" text,
  "delivery_issue_notes" text,
  "shipping_fee" numeric DEFAULT 0,
  "rider_earning" numeric DEFAULT 0,
  "rider_earning_credited" boolean DEFAULT false,
  "rider_earning_credited_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  PRIMARY KEY ("delivery_id")
);

-- RLS enabled: true
CREATE TABLE "public"."delivery_history" (
  "id" text NOT NULL DEFAULT ('dh-'::text || substr(md5((random())::text), 1, 12)),
  "order_id" text NOT NULL,
  "action" text NOT NULL,
  "previous_status" text,
  "new_status" text,
  "performed_by" text,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("id")
);

-- RLS enabled: true
CREATE TABLE "public"."riders" (
  "id" text NOT NULL DEFAULT ('rider-'::text || substr(md5((random())::text), 1, 12)),
  "name" text NOT NULL,
  "short_name" text,
  "phone" text,
  "vehicle_info" text DEFAULT ''::text,
  "plate_number" text DEFAULT ''::text,
  "avatar" text DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'::text,
  "status" text NOT NULL DEFAULT 'Available'::text,
  "rating" numeric DEFAULT 5.0,
  "notes" text DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "total_earnings" numeric DEFAULT 0,
  "user_id" text,
  "email" text,
  "username" text,
  "account_status" text NOT NULL DEFAULT 'Active'::text,
  "role" text NOT NULL DEFAULT 'Rider'::text,
  PRIMARY KEY ("id")
);

-- RLS enabled: true
CREATE TABLE "public"."rider_earnings" (
  "id" text NOT NULL DEFAULT ('re-'::text || substr(md5(((random())::text || (clock_timestamp())::text)), 1, 12)),
  "rider_id" text,
  "order_id" text,
  "delivery_id" text,
  "rider_name" text,
  "amount" numeric NOT NULL DEFAULT 0,
  "source" text DEFAULT 'shipping_fee'::text,
  "notes" text DEFAULT ''::text,
  "credited_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("id")
);

-- RLS enabled: true
CREATE TABLE "public"."rider_access_tokens" (
  "access_id" text NOT NULL DEFAULT ('rat-'::text || substr(md5(((random())::text || (clock_timestamp())::text)), 1, 12)),
  "rider_key" text NOT NULL,
  "rider_id" text,
  "rider_name" text,
  "rider_contact" text,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "invalidated_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("access_id")
);

-- RLS enabled: true
CREATE TABLE "public"."service_history" (
  "history_id" text NOT NULL DEFAULT ('hist-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text,
  "customer_id" text,
  "user_id" text,
  "customer_name" text,
  "motorcycle_id" text,
  "bike_brand" text,
  "bike_model" text,
  "bike_year" text,
  "plate_number" text,
  "package_id" text,
  "package_name" text,
  "service_type" text,
  "services_performed" jsonb DEFAULT '[]'::jsonb,
  "service_date" text,
  "package_price" numeric DEFAULT 0,
  "additional_charges" numeric DEFAULT 0,
  "additional_charges_notes" text,
  "final_price" numeric DEFAULT 0,
  "service_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("history_id")
);

-- RLS enabled: true
CREATE TABLE "public"."forecast_history" (
  "forecast_id" text NOT NULL DEFAULT ('fc-'::text || substr(md5((random())::text), 1, 12)),
  "product_id" text,
  "product_name" text NOT NULL,
  "forecast_date" date NOT NULL DEFAULT CURRENT_DATE,
  "forecast_period" text NOT NULL DEFAULT 'week'::text,
  "period_label" text,
  "period_key" text,
  "predicted_quantity" numeric NOT NULL DEFAULT 0,
  "actual_quantity" numeric,
  "slope" numeric,
  "intercept" numeric,
  "safety_stock" numeric,
  "current_stock" numeric,
  "recommended_restock" numeric,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("forecast_id")
);

-- RLS enabled: true
CREATE TABLE "public"."product_cost_history" (
  "history_id" text NOT NULL DEFAULT ('pch-'::text || substr(md5((random())::text), 1, 12)),
  "product_id" text,
  "previous_cost" numeric,
  "new_cost" numeric NOT NULL DEFAULT 0,
  "changed_by" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("history_id")
);

-- RLS enabled: true
CREATE TABLE "public"."service_cost_records" (
  "record_id" text NOT NULL DEFAULT ('scr-'::text || substr(md5((random())::text), 1, 12)),
  "service_id" text,
  "booking_id" text,
  "customer_price" numeric DEFAULT 0,
  "parts_cost" numeric DEFAULT 0,
  "materials_cost" numeric DEFAULT 0,
  "technician_cost" numeric DEFAULT 0,
  "other_cost" numeric DEFAULT 0,
  "total_cost" numeric DEFAULT 0,
  "notes" text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("record_id")
);

-- RLS enabled: true
CREATE TABLE "public"."financial_expenses" (
  "expense_id" text NOT NULL DEFAULT ('exp-'::text || substr(md5((random())::text), 1, 12)),
  "category" text NOT NULL DEFAULT 'Other'::text,
  "amount" numeric NOT NULL DEFAULT 0,
  "expense_date" date NOT NULL DEFAULT CURRENT_DATE,
  "description" text,
  "payment_method" text DEFAULT 'Cash'::text,
  "receipt_url" text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("expense_id")
);

-- RLS enabled: true
CREATE TABLE "public"."product_reviews" (
  "review_id" text NOT NULL,
  "product_id" text NOT NULL,
  "order_id" text,
  "customer_name" text NOT NULL DEFAULT 'Rider'::text,
  "rating" numeric NOT NULL DEFAULT 5,
  "comment" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("review_id")
);

-- RLS enabled: true
CREATE TABLE "public"."product_compatibility" (
  "compatibility_id" text NOT NULL DEFAULT ('pc-'::text || substr(md5((random())::text), 1, 12)),
  "product_id" text NOT NULL,
  "brand" text NOT NULL,
  "model" text NOT NULL,
  "year_from" integer,
  "year_to" integer,
  "year_exact" integer,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "model_id" text,
  PRIMARY KEY ("compatibility_id")
);

-- RLS enabled: true
CREATE TABLE "public"."customizations" (
  "customization_id" text NOT NULL DEFAULT ('custz-'::text || substr(md5((random())::text), 1, 12)),
  "customer_id" text,
  "user_id" text,
  "motorcycle_id" text,
  "motorcycle_brand" text,
  "motorcycle_model" text,
  "motorcycle_year" integer,
  "name" text NOT NULL DEFAULT 'My Customization'::text,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "total_price" numeric NOT NULL DEFAULT 0,
  "preview_image_url" text,
  "preview_prompt" text,
  "compatibility_checked" boolean DEFAULT false,
  "compatibility_ok" boolean,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "motorcycle_photo_url" text,
  "motorcycle_color" text,
  "motorcycle_type" text,
  PRIMARY KEY ("customization_id")
);

-- RLS enabled: true
CREATE TABLE "public"."customization_items" (
  "item_id" text NOT NULL DEFAULT ('czi-'::text || substr(md5((random())::text), 1, 12)),
  "customization_id" text NOT NULL,
  "product_id" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "price" numeric NOT NULL DEFAULT 0,
  "product_name" text,
  "product_brand" text,
  "product_category" text,
  "size_label" text,
  "color_label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."service_quotations" (
  "quotation_id" text NOT NULL DEFAULT ('qt-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text NOT NULL,
  "quotation_type" text NOT NULL DEFAULT 'estimated'::text,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "mechanic_id" text,
  "mechanic_name" text,
  "hourly_rate" numeric NOT NULL DEFAULT 0,
  "estimated_labor_hours" numeric DEFAULT 0,
  "actual_labor_hours" numeric,
  "labor_cost" numeric NOT NULL DEFAULT 0,
  "parts_total" numeric NOT NULL DEFAULT 0,
  "other_charges_total" numeric NOT NULL DEFAULT 0,
  "additional_charges_total" numeric NOT NULL DEFAULT 0,
  "discount_type" text,
  "discount_value" numeric DEFAULT 0,
  "discount_amount" numeric NOT NULL DEFAULT 0,
  "subtotal" numeric NOT NULL DEFAULT 0,
  "total_amount" numeric NOT NULL DEFAULT 0,
  "downpayment_type" text DEFAULT 'percent'::text,
  "downpayment_percent" numeric,
  "downpayment_amount" numeric DEFAULT 0,
  "remaining_balance" numeric DEFAULT 0,
  "notes" text,
  "sent_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "declined_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("quotation_id")
);

-- RLS enabled: true
CREATE TABLE "public"."service_quotation_items" (
  "item_id" text NOT NULL DEFAULT ('qti-'::text || substr(md5((random())::text), 1, 12)),
  "quotation_id" text NOT NULL,
  "booking_id" text,
  "item_type" text NOT NULL DEFAULT 'part'::text,
  "product_id" text,
  "product_name" text,
  "description" text,
  "quantity" numeric NOT NULL DEFAULT 1,
  "unit_price" numeric NOT NULL DEFAULT 0,
  "line_total" numeric NOT NULL DEFAULT 0,
  "unit_cost" numeric DEFAULT 0,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("item_id")
);

-- RLS enabled: true
CREATE TABLE "public"."booking_inspections" (
  "inspection_id" text NOT NULL DEFAULT ('insp-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text NOT NULL,
  "findings" text,
  "recommended_work" text,
  "photos" jsonb DEFAULT '[]'::jsonb,
  "inspected_by" text,
  "inspected_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("inspection_id")
);

-- RLS enabled: true
CREATE TABLE "public"."booking_additional_charges" (
  "charge_id" text NOT NULL DEFAULT ('bac-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text NOT NULL,
  "quotation_id" text,
  "title" text NOT NULL,
  "description" text,
  "additional_labor_hours" numeric DEFAULT 0,
  "hourly_rate" numeric DEFAULT 0,
  "labor_cost" numeric DEFAULT 0,
  "parts_total" numeric DEFAULT 0,
  "other_amount" numeric DEFAULT 0,
  "total_amount" numeric NOT NULL DEFAULT 0,
  "items" jsonb DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "responded_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("charge_id")
);

-- RLS enabled: true
CREATE TABLE "public"."booking_status_history" (
  "history_id" text NOT NULL DEFAULT ('bsh-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "changed_by" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("history_id")
);

-- RLS enabled: true
CREATE TABLE "public"."pickup_verifications" (
  "verification_id" text NOT NULL DEFAULT ('pkv-'::text || substr(md5((random())::text), 1, 12)),
  "booking_id" text NOT NULL,
  "customer_id" text,
  "qr_token" text NOT NULL,
  "payment_status" text,
  "pickup_status" text,
  "qr_valid" boolean DEFAULT false,
  "verified_by" text,
  "verified_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("verification_id")
);

-- RLS enabled: true
CREATE TABLE "public"."motorcycle_models" (
  "model_id" text NOT NULL DEFAULT ('mm-'::text || substr(md5((random())::text), 1, 12)),
  "brand" text NOT NULL,
  "model" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY ("model_id")
);

-- Foreign keys
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("user_id");
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("customer_id");
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("user_id");
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories" ("category_id");
ALTER TABLE "public"."products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers" ("supplier_id");
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."promos" ADD CONSTRAINT "promos_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts" ("discount_id");
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("customer_id");
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "public"."promos" ("promo_id");
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."addresses" ("address_id");
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."sales" ADD CONSTRAINT "sales_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments" ("payment_id");
ALTER TABLE "public"."sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("customer_id");
ALTER TABLE "public"."sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales" ("sale_id");
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("user_id");
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts" ("cart_id");
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics" ("id");
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers" ("customer_id");
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services" ("service_id");
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers" ("supplier_id");
ALTER TABLE "public"."purchase_items" ADD CONSTRAINT "purchase_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders" ("po_id");
ALTER TABLE "public"."purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."admin_pins" ADD CONSTRAINT "admin_pins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("user_id");
ALTER TABLE "public"."order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."account_logs" ADD CONSTRAINT "account_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("user_id");
ALTER TABLE "public"."order_deliveries" ADD CONSTRAINT "order_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."order_deliveries" ADD CONSTRAINT "order_deliveries_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."riders" ("id");
ALTER TABLE "public"."delivery_history" ADD CONSTRAINT "delivery_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."rider_earnings" ADD CONSTRAINT "rider_earnings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."riders" ("id");
ALTER TABLE "public"."rider_earnings" ADD CONSTRAINT "rider_earnings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders" ("order_id");
ALTER TABLE "public"."forecast_history" ADD CONSTRAINT "forecast_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."product_cost_history" ADD CONSTRAINT "product_cost_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."service_cost_records" ADD CONSTRAINT "service_cost_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."service_cost_records" ADD CONSTRAINT "service_cost_records_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services" ("service_id");
ALTER TABLE "public"."product_compatibility" ADD CONSTRAINT "product_compatibility_product_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."product_compatibility" ADD CONSTRAINT "product_compatibility_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."motorcycle_models" ("model_id");
ALTER TABLE "public"."customization_items" ADD CONSTRAINT "customization_items_customization_fkey" FOREIGN KEY ("customization_id") REFERENCES "public"."customizations" ("customization_id");
ALTER TABLE "public"."customization_items" ADD CONSTRAINT "customization_items_product_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("product_id");
ALTER TABLE "public"."service_quotations" ADD CONSTRAINT "service_quotations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."service_quotations" ADD CONSTRAINT "service_quotations_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics" ("id");
ALTER TABLE "public"."service_quotation_items" ADD CONSTRAINT "service_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."service_quotations" ("quotation_id");
ALTER TABLE "public"."service_quotation_items" ADD CONSTRAINT "service_quotation_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."booking_inspections" ADD CONSTRAINT "booking_inspections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."booking_additional_charges" ADD CONSTRAINT "booking_additional_charges_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."service_quotations" ("quotation_id");
ALTER TABLE "public"."booking_additional_charges" ADD CONSTRAINT "booking_additional_charges_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
ALTER TABLE "public"."pickup_verifications" ADD CONSTRAINT "pickup_verifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings" ("booking_id");
