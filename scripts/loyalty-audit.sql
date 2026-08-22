-- Audit: Check referential integrity
SELECT 'Missing programs for rules' as issue, COUNT(*) as count
FROM loyalty_program_rules r
LEFT JOIN loyalty_programs p ON r.program_id = p.id
WHERE p.id IS NULL;

SELECT 'Missing rules for items' as issue, COUNT(*) as count
FROM loyalty_program_items i
LEFT JOIN loyalty_program_rules r ON i.rule_id = r.id
WHERE r.id IS NULL;

SELECT 'Missing menu_items for bonus items' as issue, COUNT(*) as count
FROM loyalty_program_items i
LEFT JOIN menu_items m ON i.menu_item_id = m.id
WHERE m.id IS NULL;

-- Show active programs per tenant
SELECT t.name, COUNT(lp.id) as program_count
FROM tenants t
LEFT JOIN loyalty_programs lp ON t.id = lp.tenant_id AND lp.is_active = true
GROUP BY t.id, t.name;

-- Show recent redemptions
SELECT
  lr.redeemed_at,
  lr.kunde_email,
  lp.name as program_name,
  array_length(lr.redeemed_menu_item_ids, 1) as num_items
FROM loyalty_redemptions lr
JOIN loyalty_programs lp ON lr.program_id = lp.id
ORDER BY lr.redeemed_at DESC
LIMIT 10;
