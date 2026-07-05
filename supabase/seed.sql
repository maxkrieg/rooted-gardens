-- =============================================================
-- Rooted Gardens — Development Seed Data (task 1.9)
-- Run via: supabase db reset
-- UUID segments: 0001=accounts, 0002=properties,
--   0004=route_groups, 0005=employees, 0006=vehicles, 0007=equipment,
--   0008=visits, 000a=time_entries
-- (service_zones eliminated — frequency now lives on properties; one
-- visit per property per week.)
-- =============================================================

-- =====================
-- ACCOUNTS (5)
-- =====================
INSERT INTO accounts (id, name, contact_name, email, phone, billing_type, price_per_visit, contract_rate, contract_period, status, notes) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Hillcrest Farm',      'Tom Hillcrest',    'tom@hillcrestfarm.com',       '802-555-0101', 'per_visit', 125.00,   NULL,    NULL,       'active',      'Long-time client. Prefers Tuesday service.'),
  ('00000000-0000-0000-0001-000000000002', 'Maple Ridge HOA',     'Linda Marsh',      'lmarsh@mapleridgehoa.org',    '802-555-0102', 'contract',  NULL,     800.00,  'monthly',  'active',      'Two properties — community center and retention pond. Invoice monthly.'),
  ('00000000-0000-0000-0001-000000000003', 'The Larkin Property', 'Greg Larkin',      'glarkin@email.com',           '802-555-0103', 'per_visit',  95.00,   NULL,    NULL,       'active',      NULL),
  ('00000000-0000-0000-0001-000000000004', 'Birchwood Commons',   'Donna Park',       'dpark@birchwoodcommons.com',  '802-555-0104', 'contract',  NULL,    1200.00, 'seasonal', 'active',      'Commercial complex — two properties. Invoice seasonal.'),
  ('00000000-0000-0000-0001-000000000005', 'Old Stone Road',      'Mike & Anne Rossi','mrossi@email.com',            '802-555-0105', 'per_visit', 110.00,   NULL,    NULL,       'prospective', 'New potential client — intro visit scheduled for week of Jun 8.');

-- =====================
-- PROPERTIES (8)
-- Frequency now lives here (was on service_zones). Properties that
-- formerly had multiple zones with different frequencies are
-- consolidated to their most-frequent zone's cadence, with the
-- per-area breakdown folded into crew_notes as freeform text.
-- =====================
INSERT INTO properties (id, account_id, address, parking_notes, access_notes, crew_notes, frequency) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001',
   '42 Hillcrest Rd, Norwich, VT 05055',
   'Park on the gravel pad to the left of the barn.', NULL,
   'Watch out for the stone wall along the north edge — mow carefully.',
   'weekly'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002',
   '10 Maple Ridge Dr, Sharon, VT 05065',
   'Use the back lot off Pine St.',
   'Key fob on the team key ring — label "MR".',
   'Community center. Residents often walking — be courteous and yield foot traffic. '
   || 'Front entry: include the island beds around the flagpole. '
   || 'Courtyard: picnic table area — move tables if needed, replace after; needs attention less often than the front entry.',
   'weekly'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000002',
   '5 Pond View Ln, Sharon, VT 05065',
   'Same back lot as community center.', NULL,
   'Retention pond edge — stay 3 ft from the bank. Do not mow into the water.',
   'monthly'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000003',
   '87 River Rd, Thetford, VT 05074',
   'Park in the dirt turnout on the right before the bridge.',
   'Gate is usually unlocked. Call Greg if locked: 802-555-0103.', NULL,
   'weekly'),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000004',
   '15 Birch Ln, Hartford, VT 05047',
   'Loading dock on the east side is fine for trucks.',
   'Ask for Donna at the front desk for access to back areas.',
   'Commercial property. Front lawn: large open area, use the wide-deck mower. '
   || 'Side garden beds: trim only, no mowing — edge along the brick border. '
   || 'Pool house area: compact mower only, tight around the pool fence — needs attention less often than the lawn.',
   'weekly'),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000004',
   '20 Birch Ln, Hartford, VT 05047',
   'Same loading dock as main building.', NULL,
   'Back lot with parking island. Quick job — 20 min max.',
   'monthly'),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000005',
   '33 Old Stone Rd, Pomfret, VT 05067',
   'Pull up the long driveway and park near the garage.',
   'Gate code: #4821 (changed Jun 2026).',
   'New client. Go slowly and make a good impression.',
   'weekly'),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000005',
   '33 Old Stone Rd, Pomfret, VT 05067',
   'Same driveway as front lawn.',
   'Gate code: #4821.',
   'Garden beds around the south and north sides of the house. '
   || 'South garden: perennial beds — trim and edge carefully, no mowing. '
   || 'North beds: foundation planting along the north wall — lower priority than the south garden.',
   'biweekly');

-- =====================
-- ROUTE GROUPS (3)
-- =====================
INSERT INTO route_groups (id, name, sort_order) VALUES
  ('00000000-0000-0000-0004-000000000001', 'Norwich / Hartford Corridor', 1),
  ('00000000-0000-0000-0004-000000000002', 'Sharon VT',                   2),
  ('00000000-0000-0000-0004-000000000003', 'Thetford & Pomfret',          3);

-- =====================
-- PROPERTY ROUTE GROUPS
-- =====================
INSERT INTO property_route_groups (property_id, route_group_id, sort_order) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0004-000000000001', 1),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0004-000000000001', 2),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0004-000000000001', 3),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0004-000000000002', 1),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0004-000000000002', 2),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0004-000000000003', 1),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0004-000000000003', 2),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0004-000000000003', 3);

-- =====================
-- EMPLOYEES (5)
-- =====================
INSERT INTO employees (id, name, phone, email, role, side, active, hourly_rate) VALUES
  ('00000000-0000-0000-0005-000000000001', 'Ralph Tigertown', '802-555-0201', 'ralph@rootedgardens.com',   'owner',     'lawn',   true, NULL),
  ('00000000-0000-0000-0005-000000000002', 'Sarah Chen',      '802-555-0202', 'schen@rootedgardens.com',   'crew',      'lawn',   true, 22.00),
  ('00000000-0000-0000-0005-000000000003', 'Marcus Webb',     '802-555-0203', 'mwebb@rootedgardens.com',   'crew',      'lawn',   true, 20.00),
  ('00000000-0000-0000-0005-000000000004', 'Jake Torres',     '802-555-0204', 'jtorres@rootedgardens.com', 'crew',      'garden', true, 21.00),
  ('00000000-0000-0000-0005-000000000005', 'Diana Novak',     '802-555-0205', 'dnovak@rootedgardens.com',  'accountant', NULL,   true, NULL);

-- =====================
-- VEHICLES (3)
-- =====================
INSERT INTO vehicles (id, name, type, plate, status, notes) VALUES
  ('00000000-0000-0000-0006-000000000001', 'Blue F-150',   'truck', 'VT-ABL-221', 'available', NULL),
  ('00000000-0000-0000-0006-000000000002', 'White Ram',    'truck', 'VT-GXR-889', 'available', NULL),
  ('00000000-0000-0000-0006-000000000003', 'Green Tacoma', 'truck', 'VT-KJP-447', 'in_use',    'Currently out with Jake on a garden project.');

-- =====================
-- EQUIPMENT (4)
-- =====================
INSERT INTO equipment (id, name, type, status, last_serviced, notes) VALUES
  ('00000000-0000-0000-0007-000000000001', 'Mower #1',  'mower',   'available',   '2026-05-01', 'Wide-deck — use for Birchwood Front Lawn.'),
  ('00000000-0000-0000-0007-000000000002', 'Mower #2',  'mower',   'available',   '2026-04-15', NULL),
  ('00000000-0000-0000-0007-000000000003', 'Trimmer 1', 'trimmer', 'maintenance', '2026-03-10', 'Line replacement needed. Do not assign until serviced.'),
  ('00000000-0000-0000-0007-000000000004', 'Blower A',  'blower',  'available',   '2026-05-20', NULL);

-- =====================
-- VISITS (19) — one row per (property × week)
-- Weeks: 2026-05-25 (W1), 2026-06-01 (W2), 2026-06-08 (W3 current)
-- All week_start dates are Mondays. Monthly/biweekly properties only
-- get a visit on the weeks their cadence is due.
-- =====================

-- W1: 2026-05-25 — all 8 properties (every cadence lands here), all completed/invoiced
INSERT INTO visits (id, account_id, property_id, week_start, vehicle_id,
                    status, ended_at, service_types, completion_note,
                    invoiced_at, qbo_invoice_id, invoice_amount) VALUES
  ('00000000-0000-0000-0008-000000000001',
   '00000000-0000-0000-0001-000000000001','00000000-0000-0000-0002-000000000001',
   '2026-05-25','00000000-0000-0000-0006-000000000001',
   'completed','2026-05-27',ARRAY['mow','trim'],NULL,
   '2026-05-30 10:00:00+00','INV-001',125.00),
  ('00000000-0000-0000-0008-000000000002',
   '00000000-0000-0000-0001-000000000002','00000000-0000-0000-0002-000000000002',
   '2026-05-25','00000000-0000-0000-0006-000000000002',
   'completed','2026-05-27',ARRAY['mow','trim','edge'],NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000003',
   '00000000-0000-0000-0001-000000000002','00000000-0000-0000-0002-000000000003',
   '2026-05-25','00000000-0000-0000-0006-000000000002',
   'completed','2026-05-28',ARRAY['mow'],NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000004',
   '00000000-0000-0000-0001-000000000003','00000000-0000-0000-0002-000000000004',
   '2026-05-25','00000000-0000-0000-0006-000000000001',
   'completed','2026-05-28',ARRAY['mow','trim','edge'],NULL,
   '2026-05-30 10:00:00+00','INV-002',95.00),
  ('00000000-0000-0000-0008-000000000005',
   '00000000-0000-0000-0001-000000000004','00000000-0000-0000-0002-000000000005',
   '2026-05-25','00000000-0000-0000-0006-000000000001',
   'completed','2026-05-28',ARRAY['mow','trim','edge','cleanup'],NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000006',
   '00000000-0000-0000-0001-000000000004','00000000-0000-0000-0002-000000000006',
   '2026-05-25','00000000-0000-0000-0006-000000000001',
   'completed','2026-05-28',ARRAY['mow'],NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000007',
   '00000000-0000-0000-0001-000000000005','00000000-0000-0000-0002-000000000007',
   '2026-05-25','00000000-0000-0000-0006-000000000002',
   'completed','2026-05-29',ARRAY['mow','trim'],NULL,NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000008',
   '00000000-0000-0000-0001-000000000005','00000000-0000-0000-0002-000000000008',
   '2026-05-25','00000000-0000-0000-0006-000000000002',
   'completed','2026-05-29',ARRAY['trim','edge','cleanup'],NULL,NULL,NULL,NULL);

-- W2: 2026-06-01 — weekly properties only
INSERT INTO visits (id, account_id, property_id, week_start, vehicle_id,
                    status, ended_at, service_types,
                    invoiced_at, qbo_invoice_id, invoice_amount) VALUES
  ('00000000-0000-0000-0008-000000000009',
   '00000000-0000-0000-0001-000000000001','00000000-0000-0000-0002-000000000001',
   '2026-06-01','00000000-0000-0000-0006-000000000001',
   'completed','2026-06-02',ARRAY['mow','trim'],
   '2026-06-05 09:00:00+00','INV-003',125.00),
  ('00000000-0000-0000-0008-000000000010',
   '00000000-0000-0000-0001-000000000002','00000000-0000-0000-0002-000000000002',
   '2026-06-01','00000000-0000-0000-0006-000000000002',
   'completed','2026-06-02',ARRAY['mow','trim'],NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000011',
   '00000000-0000-0000-0001-000000000003','00000000-0000-0000-0002-000000000004',
   '2026-06-01','00000000-0000-0000-0006-000000000001',
   'completed','2026-06-03',ARRAY['mow','trim'],
   '2026-06-05 09:00:00+00','INV-004',95.00),
  ('00000000-0000-0000-0008-000000000012',
   '00000000-0000-0000-0001-000000000004','00000000-0000-0000-0002-000000000005',
   '2026-06-01','00000000-0000-0000-0006-000000000001',
   'completed','2026-06-02',ARRAY['mow','trim'],NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000013',
   '00000000-0000-0000-0001-000000000005','00000000-0000-0000-0002-000000000007',
   '2026-06-01','00000000-0000-0000-0006-000000000002',
   'completed','2026-06-04',ARRAY['mow','trim'],NULL,NULL,NULL);

-- W3: 2026-06-08 — weekly properties + Old Stone Garden (biweekly, due this week), mixed statuses
INSERT INTO visits (id, account_id, property_id, week_start, vehicle_id,
                    status, ended_at, service_types, completion_note, crew_instruction, skip_reason) VALUES
  ('00000000-0000-0000-0008-000000000014',
   '00000000-0000-0000-0001-000000000001','00000000-0000-0000-0002-000000000001',
   '2026-06-08','00000000-0000-0000-0006-000000000001',
   'completed','2026-06-09',ARRAY['mow','trim','edge'],'Trimmed fence line.',NULL,NULL),
  ('00000000-0000-0000-0008-000000000015',
   '00000000-0000-0000-0001-000000000002','00000000-0000-0000-0002-000000000002',
   '2026-06-08','00000000-0000-0000-0006-000000000002',
   'completed','2026-06-10',ARRAY['mow','trim'],NULL,NULL,NULL),
  ('00000000-0000-0000-0008-000000000016',
   '00000000-0000-0000-0001-000000000003','00000000-0000-0000-0002-000000000004',
   '2026-06-08','00000000-0000-0000-0006-000000000001',
   'completed','2026-06-11',ARRAY['mow','trim'],NULL,NULL,NULL),
  -- Birchwood Main — SKIPPED
  ('00000000-0000-0000-0008-000000000017',
   '00000000-0000-0000-0001-000000000004','00000000-0000-0000-0002-000000000005',
   '2026-06-08',NULL,'skipped',NULL,NULL,NULL,NULL,
   'Customer requested delay — irrigation system repair in progress.'),
  -- Old Stone Front — scheduled WITH crew instruction (orange cell) + open session below
  ('00000000-0000-0000-0008-000000000018',
   '00000000-0000-0000-0001-000000000005','00000000-0000-0000-0002-000000000007',
   '2026-06-08',NULL,'scheduled',NULL,NULL,NULL,
   'Gate code changed to #4821. New client — intro visit. Say hello to the owner if they are home.',NULL),
  -- Old Stone Garden (biweekly, due this week) — scheduled
  ('00000000-0000-0000-0008-000000000019',
   '00000000-0000-0000-0001-000000000005','00000000-0000-0000-0002-000000000008',
   '2026-06-08',NULL,'scheduled',NULL,NULL,NULL,NULL,NULL);

-- =====================
-- VISIT CREW
-- =====================
INSERT INTO visit_crew (visit_id, employee_id, relation) VALUES
  -- W1 v1 (Hillcrest): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v2 (Maple Ridge CC): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v3 (Maple Ridge Pond): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v4 (Larkin): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v5 (Birchwood Main, lawn + garden work): Sarah+Marcus+Jake
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000003','completed'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000004','assigned'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000004','completed'),
  -- W1 v6 (Birchwood Back Lot): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v7 (Old Stone Front): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0005-000000000003','completed'),
  -- W1 v8 (Old Stone Garden): Sarah+Jake
  ('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0005-000000000004','assigned'),
  ('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0005-000000000004','completed'),

  -- W2 v9 (Hillcrest): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0005-000000000003','completed'),
  -- W2 v10 (Maple Ridge CC): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0005-000000000003','completed'),
  -- W2 v11 (Larkin): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0005-000000000003','completed'),
  -- W2 v12 (Birchwood Main): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0005-000000000003','completed'),
  -- W2 v13 (Old Stone Front): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0005-000000000003','completed'),

  -- W3 v14 (Hillcrest, completed): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0005-000000000003','completed'),
  -- W3 v15 (Maple Ridge CC, completed): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0005-000000000003','completed'),
  -- W3 v16 (Larkin, completed): Sarah+Marcus
  ('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0005-000000000002','completed'),
  ('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0005-000000000003','assigned'),
  ('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0005-000000000003','completed'),
  -- W3 v17 (Birchwood Main, skipped): assigned but not completed
  ('00000000-0000-0000-0008-000000000017','00000000-0000-0000-0005-000000000002','assigned'),
  ('00000000-0000-0000-0008-000000000017','00000000-0000-0000-0005-000000000003','assigned'),
  -- W3 v18 (Old Stone Front, scheduled + open session): Sarah assigned
  ('00000000-0000-0000-0008-000000000018','00000000-0000-0000-0005-000000000002','assigned'),
  -- W3 v19 (Old Stone Garden, scheduled): Jake assigned
  ('00000000-0000-0000-0008-000000000019','00000000-0000-0000-0005-000000000004','assigned');

-- =====================
-- VISIT TIMES (started_at / ended_at live on visits)
-- Give a handful of completed visits a coherent start→end interval (overrides the
-- midnight ended_at from the date-only seed above), and leave one visit open to
-- exercise the in-progress / "On site" state.
-- =====================
-- Completed visits with a realistic on-site interval
UPDATE visits SET started_at = '2026-05-27 08:30:00+00', ended_at = '2026-05-27 10:15:00+00'
  WHERE id = '00000000-0000-0000-0008-000000000001';
UPDATE visits SET started_at = '2026-05-28 11:00:00+00', ended_at = '2026-05-28 12:30:00+00'
  WHERE id = '00000000-0000-0000-0008-000000000004';
UPDATE visits SET started_at = '2026-06-02 08:45:00+00', ended_at = '2026-06-02 10:30:00+00'
  WHERE id = '00000000-0000-0000-0008-000000000009';
UPDATE visits SET started_at = '2026-06-03 11:15:00+00', ended_at = '2026-06-03 12:45:00+00'
  WHERE id = '00000000-0000-0000-0008-000000000011';
UPDATE visits SET started_at = '2026-06-09 09:00:00+00', ended_at = '2026-06-09 10:45:00+00'
  WHERE id = '00000000-0000-0000-0008-000000000014';
-- OPEN: Sarah tapped Start on Old Stone Front Lawn (v18) — ended_at IS NULL → in progress
UPDATE visits SET started_at = '2026-06-13 10:00:00+00', ended_at = NULL
  WHERE id = '00000000-0000-0000-0008-000000000018';

-- =====================
-- TIME ENTRIES (2)
-- Payroll shift clock for the week of Jun 9
-- =====================
INSERT INTO time_entries (id, employee_id, date, clock_in, clock_out, break_minutes, approved) VALUES
  ('00000000-0000-0000-000a-000000000001',
   '00000000-0000-0000-0005-000000000002',
   '2026-06-09','2026-06-09 07:30:00+00','2026-06-09 16:00:00+00',30,false),
  ('00000000-0000-0000-000a-000000000002',
   '00000000-0000-0000-0005-000000000003',
   '2026-06-09','2026-06-09 07:45:00+00','2026-06-09 15:30:00+00',30,false);
