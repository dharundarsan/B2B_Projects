// Source of the additive v6 migration and bound DAL queries for both supported providers.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../apps/api');
const definitions = [
  ['Party', 'community_parties', 'name:s200 kind:s20 user_id:?s200'],
  [
    'Ownership',
    'community_ownerships',
    'unit_id:s300 party_id:s100 share:d income_share:d expense_share:d starts_on:s10 ends_on:?s10',
    ['unit_id:property_units', 'party_id:community_parties'],
  ],
  [
    'Agreement',
    'community_agreements',
    'kind:s20 debtor_party_id:s100 creditor_party_id:s100 parent_id:?s100 occupancy_id:?s100 starts_on:s10 ends_on:s10 rent:d deposit:d currency:s3 due_day:i status:s20',
    [
      'debtor_party_id:community_parties',
      'creditor_party_id:community_parties',
      'parent_id:community_agreements',
    ],
  ],
  [
    'Charge',
    'community_charges',
    'agreement_id:s100 kind:s20 period:s10 due_on:s10 amount:d currency:s3',
    ['agreement_id:community_agreements'],
    ['workspace_id,agreement_id,kind,period'],
  ],
  [
    'Payment',
    'community_payments',
    'charge_id:s100 amount:d reference:s300 status:s20 user_id:s200 submission_id:s100 verified_by:?s200',
    ['charge_id:community_charges'],
    ['workspace_id,user_id,submission_id'],
  ],
  [
    'Expense',
    'community_expenses',
    'scope:s20 unit_id:?s300 party_id:?s100 category:s100 description:t amount:d currency:s3 incurred_on:s10 paid_status:s20 user_id:s200',
    ['unit_id:property_units', 'party_id:community_parties'],
  ],
  [
    'Seller',
    'community_sellers',
    'user_id:s200 name:s200 kind:s20 status:s20 pickup:s300',
  ],
  [
    'Product',
    'community_products',
    'seller_id:s100 name:s200 description:t kind:s20 ingredients:t allergens:t price:d currency:s3 stock:i status:s20',
    ['seller_id:community_sellers'],
  ],
  [
    'Order',
    'community_orders',
    'product_id:s100 seller_id:s100 user_id:s200 group_id:?s100 quantity:i unit_price:d currency:s3 status:s20 payment_status:s20 submission_id:s100',
    [
      'product_id:community_products',
      'seller_id:community_sellers',
      'group_id:community_groups',
    ],
    ['workspace_id,user_id,submission_id'],
  ],
  [
    'Group',
    'community_groups',
    'product_id:s100 seller_id:s100 unit_price:d currency:s3 minimum:i maximum:i closes_at:s40 pickup:s300 status:s20',
    ['product_id:community_products', 'seller_id:community_sellers'],
  ],
  [
    'Pledge',
    'community_pledges',
    'group_id:s100 user_id:s200 quantity:i',
    ['group_id:community_groups'],
    ['workspace_id,group_id,user_id'],
  ],
  [
    'Gate',
    'community_gate_entries',
    'kind:s20 name:s200 unit_id:s300 occupancy_id:s100 resident_user_id:s200 expected_at:s40 approval:s20 status:s20 arrived_at:?s40 departed_at:?s40 accepted_at:?s40 received_at:?s40 user_id:s200',
    ['unit_id:property_units'],
  ],
  [
    'Facility',
    'community_facilities',
    'name:s200 capacity:i slot_minutes:i price:d currency:s3 rules:t status:s20',
  ],
  [
    'Booking',
    'community_bookings',
    'facility_id:s100 user_id:s200 starts_at:s40 ends_at:s40 status:s20 price:d currency:s3 submission_id:s100',
    ['facility_id:community_facilities'],
    ['workspace_id,user_id,submission_id'],
  ],
  [
    'Note',
    'community_notes',
    'kind:s20 title:s200 body:t user_id:s200 assigned_user_id:?s200 status:s20',
  ],
  [
    'Layout',
    'community_layouts',
    'floor:i name:s200 draft_json:t published_json:t published_at:?s40',
    [],
    ['workspace_id,property_id,floor'],
  ],
  ['Audit', 'community_audit', 'user_id:s200 entity_id:s100 action:s100'],
  [
    'Receipt',
    'community_receipts',
    'expense_id:s100 path:s1000 name:s200 content_type:s100 size:l status:s20',
    ['expense_id:community_expenses'],
  ],
];
const fields = (text) => text.split(' ').map((f) => f.split(':'));
const base = fields(
  'id:s100 workspace_id:s200 property_id:s200 revision:l created_at:s40',
);
const pascal = (s) =>
  s
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
const ordered = [...definitions];
// Groups must precede orders because MySQL checks referenced tables at CREATE time.
ordered.splice(
  ordered.findIndex((d) => d[0] === 'Order'),
  1,
);
ordered.splice(
  ordered.findIndex((d) => d[0] === 'Group') + 1,
  0,
  definitions.find((d) => d[0] === 'Order'),
);
for (const dialect of ['Common', 'MySql']) {
  const type = (token) => {
    const t = token.replace('?', '');
    return (
      (dialect === 'MySql'
        ? { d: 'DECIMAL(14,2)', i: 'INT', l: 'BIGINT', t: 'LONGTEXT' }
        : { d: 'NUMERIC', i: 'INTEGER', l: 'INTEGER', t: 'TEXT' })[t] ??
      (dialect === 'MySql' ? `VARCHAR(${t.slice(1)})` : 'TEXT')
    );
  };
  const schemas = ordered.map(([key, table, spec, refs = [], unique = []]) => {
    const columns = [...base, ...fields(spec)].map(
      ([name, token]) =>
        `  ${name} ${type(token)}${token.startsWith('?') ? '' : ' NOT NULL'}`,
    );
    columns.push(
      '  PRIMARY KEY (workspace_id,id)',
      '  UNIQUE (workspace_id,property_id,id)',
      '  FOREIGN KEY (workspace_id,property_id) REFERENCES properties(workspace_id,id)',
    );
    for (const ref of refs) {
      const [column, target] = ref.split(':');
      columns.push(
        `  FOREIGN KEY (workspace_id,property_id,${column}) REFERENCES ${target}(workspace_id,${target === 'property_units' ? 'property_id,id' : 'property_id,id'})`,
      );
    }
    for (const list of unique) columns.push(`  UNIQUE (${list})`);
    const checks = {
      Ownership: [
        'share>0 AND share<=100',
        'income_share>=0 AND income_share<=100',
        'expense_share>=0 AND expense_share<=100',
        'ends_on IS NULL OR ends_on>starts_on',
      ],
      Agreement: [
        "kind IN ('direct','master','sublease')",
        'rent>0',
        'deposit>=0',
        'due_day BETWEEN 1 AND 28',
        'ends_on>starts_on',
      ],
      Charge: ['amount>0', "kind IN ('rent','deposit')"],
      Payment: ['amount>0', "status IN ('pending','verified','rejected')"],
      Expense: [
        'amount>0',
        "scope IN ('community','unit','operator')",
        "paid_status IN ('paid','unpaid')",
      ],
      Product: ['price>0', 'stock>=0'],
      Order: [
        'quantity>0',
        'unit_price>0',
        "status IN ('placed','accepted','ready','handed_over','cancelled')",
        "payment_status IN ('unpaid','paid','refund_due','refunded')",
      ],
      Group: [
        'unit_price>0',
        'minimum>0 AND maximum>=minimum',
        "status IN ('open','confirmed','failed')",
      ],
      Pledge: ['quantity>=0'],
      Gate: [
        "approval IN ('pending','approved','denied')",
        "status IN ('expected','arrived','departed','accepted','received')",
      ],
      Facility: ['capacity>0', 'slot_minutes BETWEEN 15 AND 1440', 'price>=0'],
      Booking: ['ends_at>starts_at', 'price>=0'],
      Layout: ['floor BETWEEN -5 AND 150'],
      Receipt: ['size>0 AND size<=20971520'],
    };
    columns.push(...(checks[key] ?? []).map((c) => `  CHECK (${c})`));
    return `CREATE TABLE IF NOT EXISTS ${table} (\n${columns.join(',\n')}\n)${dialect === 'MySql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs' : ''};`;
  });
  for (const [table, entity] of [
    ['community_agreement_units', 'agreement'],
    ['community_expense_allocations', 'expense'],
  ]) {
    const alloc = entity === 'expense';
    const column = alloc ? 'party_id' : 'unit_id';
    const target = alloc ? 'community_parties' : 'property_units';
    schemas.push(
      `CREATE TABLE IF NOT EXISTS ${table} (\n  workspace_id ${type('s200')} NOT NULL,\n  property_id ${type('s200')} NOT NULL,\n  ${entity}_id ${type('s100')} NOT NULL,\n  ${column} ${type(alloc ? 's100' : 's300')} NOT NULL,\n${alloc ? `  amount ${type('d')} NOT NULL,\n` : ''}  PRIMARY KEY (workspace_id,${entity}_id,${column}),\n  FOREIGN KEY (workspace_id,property_id,${entity}_id) REFERENCES community_${alloc ? 'expenses' : 'agreements'}(workspace_id,property_id,id),\n  FOREIGN KEY (workspace_id,property_id,${column}) REFERENCES ${target}(workspace_id,property_id,id)\n)${dialect === 'MySql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs' : ''};`,
    );
  }
  const unitIndex =
    dialect === 'MySql'
      ? 'ALTER TABLE property_units ADD CONSTRAINT community_unit_scope UNIQUE (workspace_id,property_id,id);'
      : 'CREATE UNIQUE INDEX IF NOT EXISTS community_unit_scope ON property_units(workspace_id,property_id,id);';
  fs.writeFileSync(
    path.join(root, `DatabaseScripts/${dialect}/006_Community.sql`),
    '-- Additive apartment ownership, finances, commerce, gate, facilities and map module.\n' +
      unitIndex +
      '\n\n' +
      schemas.join('\n\n') +
      '\n',
  );
}
for (const [key, table, spec] of definitions) {
  const columns = [...base, ...fields(spec)].map(([name]) => name);
  fs.writeFileSync(
    path.join(root, `SQLFiles/Common/Community${key}Insert.sql`),
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((c) => '@' + pascal(c)).join(',')});\n`,
  );
  fs.writeFileSync(
    path.join(root, `SQLFiles/Common/Community${key}Update.sql`),
    `UPDATE ${table} SET ${columns
      .filter(
        (c) => !['id', 'workspace_id', 'property_id', 'created_at'].includes(c),
      )
      .map((c) => `${c}=@${pascal(c)}`)
      .join(
        ',',
      )} WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;\n`,
  );
}
const select = definitions.map(([key, table]) =>
  key === 'Charge'
    ? `SELECT c.*,COALESCE((SELECT SUM(p.amount) FROM community_payments p WHERE p.workspace_id=c.workspace_id AND p.charge_id=c.id AND p.status='verified'),0) AS verified_paid FROM community_charges c WHERE c.workspace_id=@workspace AND c.property_id=@property;`
    : `SELECT * FROM ${table} WHERE workspace_id=@workspace AND property_id=@property ORDER BY created_at,id;`,
);
fs.writeFileSync(
  path.join(root, 'SQLFiles/Common/CommunityRead.sql'),
  'SELECT * FROM properties WHERE workspace_id=@workspace AND id=@property AND archived=0;\nSELECT * FROM property_units WHERE workspace_id=@workspace AND property_id=@property ORDER BY label;\n' +
    select.join('\n') +
    '\nSELECT agreement_id,unit_id FROM community_agreement_units WHERE workspace_id=@workspace AND property_id=@property;\nSELECT expense_id,party_id,amount FROM community_expense_allocations WHERE workspace_id=@workspace AND property_id=@property;\nSELECT * FROM community_services WHERE workspace_id=@workspace AND property_id=@property ORDER BY created_at,id;\nSELECT * FROM community_service_requests WHERE workspace_id=@workspace AND property_id=@property ORDER BY created_at,id;\n',
);
fs.writeFileSync(
  path.join(root, 'SQLFiles/Common/CommunityContext.sql'),
  `SELECT id,name,address,timezone,units FROM properties WHERE workspace_id=@workspace AND archived=0 ORDER BY name;
SELECT DISTINCT p.property_id FROM community_parties p WHERE p.workspace_id=@workspace AND p.user_id=@user AND
 (EXISTS (SELECT 1 FROM community_ownerships o WHERE o.workspace_id=p.workspace_id AND o.party_id=p.id) OR
 EXISTS (SELECT 1 FROM community_agreements a WHERE a.workspace_id=p.workspace_id AND (a.debtor_party_id=p.id OR a.creditor_party_id=p.id) AND a.status='active'));\n`,
);
fs.writeFileSync(
  path.join(root, 'SQLFiles/Common/CommunityAgreementUnitInsert.sql'),
  'INSERT INTO community_agreement_units(workspace_id,property_id,agreement_id,unit_id) VALUES (@workspace,@property,@agreement,@unit);\n',
);
fs.writeFileSync(
  path.join(root, 'SQLFiles/Common/CommunityAllocationInsert.sql'),
  'INSERT INTO community_expense_allocations(workspace_id,property_id,expense_id,party_id,amount) VALUES (@workspace,@property,@expense,@party,@amount);\n',
);
console.log('Generated v6 migrations and community SQL queries.');
const tables = definitions
  .map((d) => d[1])
  .concat('community_agreement_units', 'community_expense_allocations');
const preflight = path.join(
  root,
  'SQLFiles/MySql/PreflightReadPermissions.sql',
);
let permission = fs
  .readFileSync(preflight, 'utf8')
  .replace(/\n-- Community v6[\s\S]*$/, '');
fs.writeFileSync(
  preflight,
  permission.trimEnd() +
    '\n-- Community v6\nSELECT * FROM users WHERE 1=0;\nSELECT * FROM user_memberships WHERE 1=0;\nSELECT * FROM user_admin_audit WHERE 1=0;\nSELECT * FROM community_services WHERE 1=0;\nSELECT * FROM community_service_requests WHERE 1=0;\n' +
    tables.map((t) => `SELECT * FROM ${t} WHERE 1=0;`).join('\n') +
    '\n',
);
const crypto = require('node:crypto');
for (const dialect of ['MySql', 'Sqlite']) {
  const file = path.resolve(
    __dirname,
    `../docs/schema/RepairLedger-Final-${dialect}.sql`,
  );
  let snapshot = fs
    .readFileSync(file, 'utf8')
    .replace(/-- BEGIN MANAGEMENT V8[\s\S]*?-- END MANAGEMENT V8\s*/, '')
    .replace(/-- BEGIN USER CONTEXT V7[\s\S]*?-- END USER CONTEXT V7\s*/, '')
    .replace(/-- BEGIN COMMUNITY V6[\s\S]*?-- END COMMUNITY V6\s*/, '');
  const migration = fs.readFileSync(
    path.join(
      root,
      `DatabaseScripts/${dialect === 'MySql' ? 'MySql' : 'Common'}/006_Community.sql`,
    ),
    'utf8',
  );
  snapshot = snapshot.replace(
    /-- Mark the baseline compatible with the application's \w+ versioned migrations\./,
    `-- BEGIN COMMUNITY V6\n${migration}\n-- END COMMUNITY V6\n\n-- BEGIN USER CONTEXT V7\n${fs.readFileSync(path.join(root, `DatabaseScripts/${dialect === 'MySql' ? 'MySql' : 'Common'}/007_UserContext.sql`), 'utf8')}\n-- END USER CONTEXT V7\n\n-- BEGIN MANAGEMENT V8\n${fs.readFileSync(path.join(root, `DatabaseScripts/${dialect === 'MySql' ? 'MySql' : 'Common'}/008_ManagementViews.sql`), 'utf8')}\n-- END MANAGEMENT V8\n\n-- Mark the baseline compatible with the application's eight versioned migrations.`,
  );
  if (dialect === 'MySql') {
    const names = [
      '001_initial',
      '002_relational_history',
      '003_integrity',
      '004_mobile_operations',
      '005_resident_privacy',
      '006_Community',
      '007_UserContext',
      '008_ManagementViews',
    ];
    const rows = names.map((name, index) => {
      const script = fs.readFileSync(
        path.join(root, `DatabaseScripts/MySql/${name}.sql`),
        'utf8',
      );
      const hash = crypto
        .createHash('sha256')
        .update(script.replaceAll('\r\n', '\n').trim())
        .digest('hex')
        .toUpperCase();
      return ` (${index + 1},DATE_FORMAT(UTC_TIMESTAMP(6),'%Y-%m-%dT%H:%i:%s.%f+00:00'),1,'${hash}')`;
    });
    snapshot = snapshot.replace(
      /INSERT INTO schema_migrations\(version,applied_at,completed,checksum\) VALUES[\s\S]*?;/,
      'INSERT INTO schema_migrations(version,applied_at,completed,checksum) VALUES\n' +
        rows.join(',\n') +
        ';',
    );
  } else
    snapshot = snapshot.replace(
      /INSERT INTO schema_migrations\(version,applied_at\) VALUES[\s\S]*?;/,
      'INSERT INTO schema_migrations(version,applied_at) VALUES\n ' +
        Array.from(
          { length: 8 },
          (_, i) => `(${i + 1},CAST(CURRENT_TIMESTAMP AS TEXT))`,
        ).join(',') +
        ';',
    );
  fs.writeFileSync(file, snapshot);
}
