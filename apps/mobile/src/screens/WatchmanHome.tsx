import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { useI18n } from '../lib/i18n';
import { formatDate, formatTime, presenceAction } from '../lib/policy';
import { useResource } from '../hooks/useResource';
import type { GateVisit } from '../types';
import { Badge, Button, Card, Chips, Empty, Heading, Icon, Loading, Notice, Screen, Section, colors, s } from '../components/ui';
import { Confirmation } from '../components/Confirmation';

export default function WatchmanHome() {
  const { context, client } = useAuth(); const { t, language } = useI18n();
  const resource = useResource(signal => client.visits(signal), [] as GateVisit[]);
  const [filter, setFilter] = useState('all'); const [selected, setSelected] = useState<GateVisit | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const expected = resource.data.filter(v => !v.arrivedAt).length; const onSite = resource.data.filter(v => v.arrivedAt && !v.departedAt).length;
  const filtered = resource.data.filter(v => filter === 'all' || (filter === 'expected' ? !v.arrivedAt : filter === 'onSite' ? v.arrivedAt && !v.departedAt : !!v.departedAt));
  const record = async () => {
    if (!selected || lock.current) return; const action = presenceAction(selected); if (!action) return;
    lock.current = true; setBusy(true); setError('');
    try { const next = await client.presence(selected, action); resource.setData(values => values.map(v => v.id === next.id ? next : v)); setSelected(null); resource.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : t('invalid')); setSelected(null); resource.refresh(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen refreshing={resource.loading && resource.data.length > 0} onRefresh={resource.refresh}>
    <Heading eyebrow={t('today')} title={t('welcomeWatchman')} subtitle={context?.properties.map(p => p.name).join(' · ') || t('noAssignment')}
      trailing={<View style={[s.avatar, { backgroundColor: colors.brand }]}><Icon name="shield-checkmark-outline" /></View>} />
    {!context?.properties.length ? <Notice message={t('noAssignmentHelp')} /> : null}
    <View style={[s.row, { alignItems: 'stretch' }]}><View style={s.metric}><Text style={s.number}>{expected}</Text><Text style={s.small}>{t('expected')}</Text></View><View style={[s.metric, { backgroundColor: colors.lavender }]}><Text style={s.number}>{onSite}</Text><Text style={s.small}>{t('onSite')}</Text></View></View>
    <Notice message={t('gateHelp')} />
    <Section title={t('todayVisits')} /><Chips value={filter} onChange={setFilter} options={[{ value: 'all', label: t('all') }, { value: 'expected', label: t('expected') }, { value: 'onSite', label: t('onSite') }, { value: 'finished', label: t('finished') }]} />
    {resource.error || error ? <Notice danger message={error || resource.error} onRetry={resource.refresh} /> : null}
    {resource.loading && !resource.data.length ? <Loading /> : null}
    {filtered.map(visit => <Card key={visit.id}><View style={s.spread}><Badge label={visit.departedAt ? t('finished') : visit.arrivedAt ? t('onSite') : t('expected')} tone={visit.arrivedAt ? 'green' : 'normal'} /><Text style={s.label}>{formatTime(visit.startsAt, visit.timezone, language)}</Text></View>
      <View style={s.row}><View style={s.avatar}><Icon name={visit.trade === 'Electrical' ? 'flash-outline' : 'construct-outline'} /></View><View style={{ flex: 1 }}><Text style={s.h3}>{visit.vendorName}</Text><Text style={s.small}>{visit.trade}</Text></View></View>
      <Text style={s.body}>{visit.propertyName} · {visit.unit}</Text><Text style={s.small}>{formatDate(visit.startsAt, visit.timezone, language)} · {visit.timezone}</Text>
      {visit.arrivedAt ? <Text style={s.small}>{t('arrivedAt')}: {formatTime(visit.arrivedAt, visit.timezone, language)}</Text> : null}
      {visit.departedAt ? <Text style={s.small}>{t('departedAt')}: {formatTime(visit.departedAt, visit.timezone, language)}</Text> : <Button label={visit.arrivedAt ? t('depart') : t('arrive')} icon={visit.arrivedAt ? 'exit-outline' : 'enter-outline'} variant={visit.arrivedAt ? 'secondary' : 'primary'} disabled={busy} onPress={() => setSelected(visit)} />}
    </Card>)}
    {!resource.loading && !resource.error && !filtered.length ? <Empty title={t('noVisits')} detail={t('noVisitsHelp')} icon="calendar-outline" /> : null}
    <Button label={t('quickReport')} variant="secondary" icon="add" onPress={() => router.push('/report')} disabled={!context?.properties.length} />
    {selected ? <Confirmation title={selected.arrivedAt ? t('departureQuestion') : t('arrivalQuestion')} detail={`${selected.vendorName} · ${selected.propertyName} · ${selected.unit}`} busy={busy} onCancel={() => setSelected(null)} onConfirm={() => { void record(); }} /> : null}
  </Screen>;
}
