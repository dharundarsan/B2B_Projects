import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirm, canReport, canVerify, assertImage, formatTime, isMobileRole, presenceAction } from '../src/lib/policy';
import { createPreviewClient } from '../src/lib/demo';
import type { Appointment, GateVisit, MobileContext, Repair } from '../src/types';

const context: MobileContext = { role: 'tenant', email: 'a@example.test', properties: [{ id: 'p1', name: 'Building', timezone: 'UTC', units: ['204'] }] };
test('Only supported roles and assigned apartments can report', () => {
  assert.ok(isMobileRole('tenant')); assert.ok(isMobileRole('watchman')); assert.equal(isMobileRole('owner'), false);
  assert.ok(canReport(context, 'p1', '204')); assert.equal(canReport(context, 'p1', '205'), false); assert.equal(canReport(context, 'p2'), false);
  assert.equal(canReport({ ...context, role: 'watchman' }, 'p1', '204'), false); assert.ok(canReport({ ...context, role: 'watchman' }, 'p1'));
});
test('Visit confirmation and verification controls match resident permissions', () => {
  const visit = { status: 'proposed' } as Appointment;
  assert.ok(canConfirm('tenant', visit)); assert.equal(canConfirm('watchman', visit), false);
  assert.equal(canConfirm('tenant', { ...visit, residentConfirmedAt: '2026-10-02' }), false);
  assert.ok(canVerify('tenant', { state: 'verification' } as Repair)); assert.equal(canVerify('watchman', { state: 'verification' } as Repair), false);
});
test('Gate actions follow arrival then departure without reopening a finished visit', () => {
  const visit = {} as GateVisit; assert.equal(presenceAction(visit), 'arrive');
  assert.equal(presenceAction({ ...visit, arrivedAt: 'now' }), 'depart'); assert.equal(presenceAction({ ...visit, arrivedAt: 'now', departedAt: 'later' }), null);
});
test('Photo validation rejects empty, unsupported and oversized uploads', () => {
  assertImage('image/jpeg', 1); assertImage('image/png', 20 * 1024 * 1024);
  for (const [type, size] of [['image/heic', 1], ['image/jpeg', 0], ['image/jpeg', 20971521]] as const) assert.throws(() => assertImage(type, size));
});
test('Invalid date and timezone display fail safely', () => { assert.equal(formatTime('bad', 'UTC', 'en'), '—'); assert.equal(formatTime('2026-10-02', 'bad', 'en'), '—'); });
test('Resident preview supports confirmation, verification and conversations without a server', async () => {
  const client = createPreviewClient('tenant'); const repairs = await client.repairs();
  const scheduled = repairs.find(r => r.id === 'r1')!;
  const confirmed = await client.confirm(scheduled, scheduled.appointments[0]!.id, true); assert.equal(confirmed.appointments[0]!.status, 'confirmed');
  const verification = repairs.find(r => r.id === 'r2')!; assert.equal((await client.verify(verification, false, 'Still broken')).state, 'in_progress');
  await client.send('r1', 'Thanks for the update'); assert.equal((await client.messages('r1')).at(-1)!.body, 'Thanks for the update');
  const raw = await client.repair('r1'); raw.title = 'mutated outside client'; assert.notEqual((await client.repair('r1')).title, raw.title);
});
test('Watchman preview gate workflow cannot access resident records', async () => {
  const client = createPreviewClient('watchman'); await assert.rejects(client.repairs(), /Resident/); await assert.rejects(client.messages('r1'), /Resident/);
  const first = (await client.visits())[0]!; const arrived = await client.presence(first, 'arrive'); assert.ok(arrived.arrivedAt);
  const departed = await client.presence(arrived, 'depart'); assert.ok(departed.departedAt); await assert.rejects(client.presence(first, 'arrive'), /Refresh/);
});
