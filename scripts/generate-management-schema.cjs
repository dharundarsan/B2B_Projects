// Additive v8 only. Previously deployed migrations stay byte-for-byte intact.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../apps/api');
const extra = [
  ['Service','community_services','seller_id:s100 name:s200 category:s100 description:t price:d currency:s3 price_unit:s20 status:s20',['seller_id:community_sellers']],
  ['ServiceRequest','community_service_requests','service_id:s100 seller_id:s100 user_id:s200 service_name:s200 description:t preferred_at:s40 price:d currency:s3 price_unit:s20 status:s20 submission_id:s100',['service_id:community_services','seller_id:community_sellers']]
];
const fields = spec => spec.split(' ').map(f => f.split(':'));
const pascal = s => s.split('_').map(w => w[0].toUpperCase()+w.slice(1)).join('');
const base = fields('workspace_id:s200 property_id:s200 id:s100 revision:l created_at:s40');
for (const dialect of ['Common','MySql']) {
  const mysql = dialect === 'MySql';
  const type = t => (mysql ? {i:'INT',l:'BIGINT',d:'DECIMAL(14,2)',t:'LONGTEXT'} : {i:'INTEGER',l:'INTEGER',d:'NUMERIC',t:'TEXT'})[t] ?? (mysql ? `VARCHAR(${t.slice(1)})` : 'TEXT');
  const suffix = mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs' : '';
  const managementColumns = [
    ['display_name',mysql?'VARCHAR(200)':'TEXT',"NOT NULL DEFAULT ''"],['email',mysql?'VARCHAR(254)':'TEXT',"NOT NULL DEFAULT ''"],
    ['identity_role',mysql?'VARCHAR(20)':'TEXT',"NOT NULL DEFAULT ''"],['managed_role',mysql?'VARCHAR(20)':'TEXT','NULL'],
    ['status',mysql?'VARCHAR(20)':'TEXT',"NOT NULL DEFAULT 'active'"],['allow_user',mysql?'TINYINT':'INTEGER','NOT NULL DEFAULT 1'],
    ['allow_admin',mysql?'TINYINT':'INTEGER','NOT NULL DEFAULT 0'],['allow_seller',mysql?'TINYINT':'INTEGER','NOT NULL DEFAULT 0'],
    ['created_at',mysql?'VARCHAR(40)':'TEXT',"NOT NULL DEFAULT ''"]
  ];
  let script;
  if(mysql) script = 'ALTER TABLE users DROP CHECK users_context_valid;\nALTER TABLE users ADD CONSTRAINT users_context_allowed CHECK (user_context IN (1,2,3));\n'+managementColumns.map(([n,t,r])=>`ALTER TABLE users ADD COLUMN ${n} ${t} ${r};`).join('\n')+'\n';
  else script = `CREATE TABLE users_v8 (workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,user_context INTEGER NOT NULL DEFAULT 1 CHECK (user_context IN (1,2,3)),revision INTEGER NOT NULL DEFAULT 0,${managementColumns.map(([n,t,r])=>`${n} ${t} ${r}`).join(',')},PRIMARY KEY(workspace_id,user_id));\nINSERT INTO users_v8(workspace_id,user_id,user_context,revision) SELECT workspace_id,user_id,user_context,revision FROM users;\nDROP TABLE users;\nALTER TABLE users_v8 RENAME TO users;\n`;
  script += `CREATE TABLE IF NOT EXISTS user_memberships (workspace_id ${type('s200')} NOT NULL,user_id ${type('s200')} NOT NULL,property_id ${type('s200')} NOT NULL,unit_id ${type('s300')} NULL,occupancy_id ${type('s100')} NULL,starts_at ${type('s40')} NULL,ends_at ${type('s40')} NULL,PRIMARY KEY(workspace_id,user_id,property_id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id),FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id),FOREIGN KEY(workspace_id,property_id,unit_id) REFERENCES property_units(workspace_id,property_id,id))${suffix};\n`;
  script += `CREATE TABLE IF NOT EXISTS user_admin_audit (workspace_id ${type('s200')} NOT NULL,id ${type('s100')} NOT NULL,user_id ${type('s200')} NOT NULL,actor_id ${type('s200')} NOT NULL,action ${type('s40')} NOT NULL,created_at ${type('s40')} NOT NULL,PRIMARY KEY(workspace_id,id),FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,user_id))${suffix};\n`;
  for(const [kind,table,spec,refs] of extra) {
    const cols = [...base,...fields(spec)].map(([n,t])=>`${n} ${type(t)} NOT NULL`);
    cols.push('PRIMARY KEY(workspace_id,id)','UNIQUE(workspace_id,property_id,id)','FOREIGN KEY(workspace_id,property_id) REFERENCES properties(workspace_id,id)');
    refs.forEach(ref=>{const [col,target]=ref.split(':');cols.push(`FOREIGN KEY(workspace_id,property_id,${col}) REFERENCES ${target}(workspace_id,property_id,id)`)});
    cols.push('CHECK(price>0)',"CHECK(price_unit IN ('visit','hour','fixed'))",kind==='Service'?"CHECK(status IN ('active','paused'))":"CHECK(status IN ('requested','accepted','completed','declined','cancelled'))");
    if(kind==='ServiceRequest') cols.push('UNIQUE(workspace_id,user_id,submission_id)');
    script += `CREATE TABLE IF NOT EXISTS ${table} (${cols.join(',')})${suffix};\n`;
  }
  fs.writeFileSync(path.join(root,`DatabaseScripts/${dialect}/008_ManagementViews.sql`),script);
}
for(const [kind,table,spec] of extra){
  const cols=[...base,...fields(spec)];
  fs.writeFileSync(path.join(root,`SQLFiles/Common/Community${kind}Insert.sql`),`INSERT INTO ${table}(${cols.map(([n])=>n).join(',')}) VALUES (${cols.map(([n])=>'@'+pascal(n)).join(',')});\n`);
  fs.writeFileSync(path.join(root,`SQLFiles/Common/Community${kind}Update.sql`),`UPDATE ${table} SET ${cols.filter(([n])=>!['workspace_id','property_id','id','created_at'].includes(n)).map(([n])=>`${n}=@${pascal(n)}`).join(',')} WHERE workspace_id=@WorkspaceId AND property_id=@PropertyId AND id=@Id AND revision=@Revision-1;\n`);
}
console.log('Generated additive v8 user management, provider services and SQL.');
