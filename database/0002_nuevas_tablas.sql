-- Migración 0002: 32 tablas nuevas (sucursales, proveedores, cotizaciones,
-- almacenes, seguridad y analítica). Idempotente: usa IF NOT EXISTS.
-- Alternativa preferida: `alembic upgrade head` (aplicada en la BD actual).

CREATE TABLE IF NOT EXISTS branches (
	company_id BIGINT NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	address VARCHAR(255), 
	phone VARCHAR(20), 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_branches_company_code UNIQUE (company_id, code), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_branches_company_id ON branches (company_id);

CREATE TABLE IF NOT EXISTS suppliers (
	company_id BIGINT NOT NULL, 
	ruc VARCHAR(15) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	email VARCHAR(160), 
	phone VARCHAR(20), 
	address VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_suppliers_company_ruc UNIQUE (company_id, ruc), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_suppliers_company_id ON suppliers (company_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
	company_id BIGINT NOT NULL, 
	supplier_id BIGINT NOT NULL, 
	order_number VARCHAR(30) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	total NUMERIC(12, 2) NOT NULL, 
	notes TEXT, 
	created_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_purchase_orders_company_number UNIQUE (company_id, order_number), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_id ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_company_id ON purchase_orders (company_id);

CREATE TABLE IF NOT EXISTS purchase_order_details (
	purchase_order_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_cost NUMERIC(12, 2) NOT NULL, 
	subtotal NUMERIC(12, 2) NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_purchase_order_details_purchase_order_id ON purchase_order_details (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_purchase_order_details_product_id ON purchase_order_details (product_id);

CREATE TABLE IF NOT EXISTS quotes (
	company_id BIGINT NOT NULL, 
	customer_id BIGINT NOT NULL, 
	quote_number VARCHAR(30) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	valid_until DATE, 
	subtotal NUMERIC(12, 2) NOT NULL, 
	tax NUMERIC(12, 2) NOT NULL, 
	total NUMERIC(12, 2) NOT NULL, 
	notes TEXT, 
	created_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_quotes_company_number UNIQUE (company_id, quote_number), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(customer_id) REFERENCES customers (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_quotes_company_id ON quotes (company_id);
CREATE INDEX IF NOT EXISTS ix_quotes_customer_id ON quotes (customer_id);

CREATE TABLE IF NOT EXISTS quote_details (
	quote_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(12, 2) NOT NULL, 
	discount NUMERIC(12, 2) NOT NULL, 
	subtotal NUMERIC(12, 2) NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(quote_id) REFERENCES quotes (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_quote_details_quote_id ON quote_details (quote_id);
CREATE INDEX IF NOT EXISTS ix_quote_details_product_id ON quote_details (product_id);

CREATE TABLE IF NOT EXISTS sales_returns (
	company_id BIGINT NOT NULL, 
	sale_id BIGINT NOT NULL, 
	return_number VARCHAR(30) NOT NULL, 
	reason TEXT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	total NUMERIC(12, 2) NOT NULL, 
	created_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_sales_returns_company_number UNIQUE (company_id, return_number), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(sale_id) REFERENCES sales (id) ON DELETE RESTRICT, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_sales_returns_sale_id ON sales_returns (sale_id);
CREATE INDEX IF NOT EXISTS ix_sales_returns_company_id ON sales_returns (company_id);

CREATE TABLE IF NOT EXISTS sales_return_details (
	return_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(12, 2) NOT NULL, 
	subtotal NUMERIC(12, 2) NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(return_id) REFERENCES sales_returns (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_sales_return_details_return_id ON sales_return_details (return_id);
CREATE INDEX IF NOT EXISTS ix_sales_return_details_product_id ON sales_return_details (product_id);

CREATE TABLE IF NOT EXISTS units (
	company_id BIGINT NOT NULL, 
	name VARCHAR(30) NOT NULL, 
	symbol VARCHAR(10), 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_units_company_name UNIQUE (company_id, name), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_units_company_id ON units (company_id);

CREATE TABLE IF NOT EXISTS price_lists (
	company_id BIGINT NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_price_lists_company_id ON price_lists (company_id);

CREATE TABLE IF NOT EXISTS price_list_items (
	price_list_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	price NUMERIC(12, 2) NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_price_list_items_list_product UNIQUE (price_list_id, product_id), 
	FOREIGN KEY(price_list_id) REFERENCES price_lists (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_price_list_items_product_id ON price_list_items (product_id);
CREATE INDEX IF NOT EXISTS ix_price_list_items_price_list_id ON price_list_items (price_list_id);

CREATE TABLE IF NOT EXISTS promotions (
	company_id BIGINT NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	kind VARCHAR(10) NOT NULL, 
	value NUMERIC(12, 2) NOT NULL, 
	starts_at TIMESTAMP WITH TIME ZONE, 
	ends_at TIMESTAMP WITH TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_promotions_company_id ON promotions (company_id);

CREATE TABLE IF NOT EXISTS product_promotions (
	promotion_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_product_promotions_promo_product UNIQUE (promotion_id, product_id), 
	FOREIGN KEY(promotion_id) REFERENCES promotions (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_product_promotions_promotion_id ON product_promotions (promotion_id);
CREATE INDEX IF NOT EXISTS ix_product_promotions_product_id ON product_promotions (product_id);

CREATE TABLE IF NOT EXISTS customer_segments (
	company_id BIGINT NOT NULL, 
	name VARCHAR(60) NOT NULL, 
	description TEXT, 
	min_purchases INTEGER NOT NULL, 
	min_total NUMERIC(12, 2) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_customer_segments_company_name UNIQUE (company_id, name), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_customer_segments_company_id ON customer_segments (company_id);

CREATE TABLE IF NOT EXISTS customer_interactions (
	company_id BIGINT NOT NULL, 
	customer_id BIGINT NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	subject VARCHAR(150) NOT NULL, 
	notes TEXT, 
	performed_by BIGINT, 
	occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(customer_id) REFERENCES customers (id) ON DELETE CASCADE, 
	FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_customer_interactions_company_id ON customer_interactions (company_id);
CREATE INDEX IF NOT EXISTS ix_customer_interactions_customer_id ON customer_interactions (customer_id);

CREATE TABLE IF NOT EXISTS warehouses (
	company_id BIGINT NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	address VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_warehouses_company_code UNIQUE (company_id, code), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_warehouses_company_id ON warehouses (company_id);

CREATE TABLE IF NOT EXISTS warehouse_stocks (
	warehouse_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	stock INTEGER NOT NULL, 
	min_stock INTEGER NOT NULL, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_warehouse_stocks_wh_product UNIQUE (warehouse_id, product_id), 
	FOREIGN KEY(warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_warehouse_stocks_product_id ON warehouse_stocks (product_id);
CREATE INDEX IF NOT EXISTS ix_warehouse_stocks_warehouse_id ON warehouse_stocks (warehouse_id);

CREATE TABLE IF NOT EXISTS stock_counts (
	company_id BIGINT NOT NULL, 
	warehouse_id BIGINT NOT NULL, 
	count_number VARCHAR(30) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	notes TEXT, 
	counted_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_stock_counts_company_number UNIQUE (company_id, count_number), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT, 
	FOREIGN KEY(counted_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_stock_counts_warehouse_id ON stock_counts (warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_counts_company_id ON stock_counts (company_id);

CREATE TABLE IF NOT EXISTS stock_count_details (
	stock_count_id BIGINT NOT NULL, 
	product_id BIGINT NOT NULL, 
	expected_qty INTEGER NOT NULL, 
	counted_qty INTEGER NOT NULL, 
	difference INTEGER NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(stock_count_id) REFERENCES stock_counts (id) ON DELETE CASCADE, 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_stock_count_details_product_id ON stock_count_details (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_count_details_stock_count_id ON stock_count_details (stock_count_id);

CREATE TABLE IF NOT EXISTS shipments (
	company_id BIGINT NOT NULL, 
	sale_id BIGINT NOT NULL, 
	carrier VARCHAR(80), 
	tracking_code VARCHAR(60), 
	status VARCHAR(20) NOT NULL, 
	shipped_at TIMESTAMP WITH TIME ZONE, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_shipments_company_tracking UNIQUE (company_id, tracking_code), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(sale_id) REFERENCES sales (id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_shipments_company_id ON shipments (company_id);
CREATE INDEX IF NOT EXISTS ix_shipments_sale_id ON shipments (sale_id);

CREATE TABLE IF NOT EXISTS permissions (
	code VARCHAR(60) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	description TEXT, 
	id BIGSERIAL NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
	role_id BIGINT NOT NULL, 
	permission_id BIGINT NOT NULL, 
	granted BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_role_permissions_role_permission UNIQUE (role_id, permission_id), 
	FOREIGN KEY(role_id) REFERENCES roles (id) ON DELETE CASCADE, 
	FOREIGN KEY(permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS ix_role_permissions_permission_id ON role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
	user_id BIGINT NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
	user_id BIGINT, 
	email VARCHAR(160) NOT NULL, 
	success BOOLEAN NOT NULL, 
	ip VARCHAR(45), 
	attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	id BIGSERIAL NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_login_attempts_attempted_at ON login_attempts (attempted_at);
CREATE INDEX IF NOT EXISTS ix_login_attempts_user_id ON login_attempts (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
	user_id BIGINT NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITH TIME ZONE, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_password_resets_user_id ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS ix_password_resets_token_hash ON password_resets (token_hash);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
	company_id BIGINT NOT NULL, 
	kpi_code VARCHAR(40) NOT NULL, 
	period_start DATE NOT NULL, 
	period_end DATE NOT NULL, 
	value NUMERIC(14, 4) NOT NULL, 
	payload JSON, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_kpi_snapshots_company_id ON kpi_snapshots (company_id);
CREATE INDEX IF NOT EXISTS ix_kpi_snapshots_kpi_code ON kpi_snapshots (kpi_code);

CREATE TABLE IF NOT EXISTS scheduled_reports (
	company_id BIGINT NOT NULL, 
	report_type VARCHAR(40) NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	parameters JSON, 
	frequency VARCHAR(10) NOT NULL, 
	next_run_at TIMESTAMP WITH TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	created_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_scheduled_reports_company_id ON scheduled_reports (company_id);

CREATE TABLE IF NOT EXISTS data_exports (
	company_id BIGINT NOT NULL, 
	export_type VARCHAR(40) NOT NULL, 
	format VARCHAR(10) NOT NULL, 
	status VARCHAR(15) NOT NULL, 
	row_count INTEGER, 
	requested_by BIGINT, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(requested_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_data_exports_company_id ON data_exports (company_id);

CREATE TABLE IF NOT EXISTS automation_rules (
	company_id BIGINT NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	description TEXT, 
	condition JSON, 
	action JSON, 
	severity VARCHAR(10) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_automation_rules_company_code UNIQUE (company_id, code), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_automation_rules_company_id ON automation_rules (company_id);

CREATE TABLE IF NOT EXISTS notifications (
	company_id BIGINT NOT NULL, 
	user_id BIGINT, 
	level VARCHAR(10) NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	message TEXT NOT NULL, 
	read_at TIMESTAMP WITH TIME ZONE, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_notifications_company_id ON notifications (company_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);

CREATE TABLE IF NOT EXISTS system_settings (
	company_id BIGINT NOT NULL, 
	key VARCHAR(60) NOT NULL, 
	value JSON, 
	id BIGSERIAL NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_system_settings_company_key UNIQUE (company_id, key), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_system_settings_company_id ON system_settings (company_id);

CREATE TABLE IF NOT EXISTS app_events (
	company_id BIGINT, 
	event_type VARCHAR(60) NOT NULL, 
	entity VARCHAR(60), 
	entity_id BIGINT, 
	payload JSON, 
	id BIGSERIAL NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_app_events_event_type ON app_events (event_type);
CREATE INDEX IF NOT EXISTS ix_app_events_company_id ON app_events (company_id);
