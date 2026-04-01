-- View for searching stock movements with flattened names
CREATE OR REPLACE VIEW stock_movements_expanded AS
SELECT 
    sm.*,
    p.name as product_name,
    pv.name as variant_name,
    pv.sku as variant_sku,
    w.name as warehouse_name,
    w.code as warehouse_code
FROM stock_movements sm
LEFT JOIN products p ON sm.product_id = p.id
LEFT JOIN product_variants pv ON sm.variant_id = pv.id
LEFT JOIN warehouses w ON sm.outlet_id = w.id;

-- View for searching current stock with flattened names
CREATE OR REPLACE VIEW warehouse_inventory_expanded AS
SELECT 
    wi.*,
    p.name as product_name,
    pv.name as variant_name,
    pv.sku as variant_sku,
    w.name as warehouse_name
FROM warehouse_inventory wi
LEFT JOIN products p ON wi.product_id = p.id
LEFT JOIN product_variants pv ON wi.variant_id = pv.id
LEFT JOIN warehouses w ON wi.warehouse_id = w.id;
;