import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { useI18n } from '../lib/i18n';
import { canConfirm, formatDate, formatTime, isOpen } from '../lib/policy';
import { useResource } from '../hooks/useResource';
import type { Repair } from '../types';
import { Badge, Button, Card, Empty, Heading, Icon, Loading, Notice, Screen, Section, colors, s } from '../components/ui';
import { RepairCard } from '../components/RepairCard';

export default function ResidentHome() {
  const { client, context } = useAuth(); const { t, language } = useI18n();
  const resource = useResource(signal => client.repairs(signal), [] as Repair[]);
  const open = resource.data.filter(isOpen); const action = open.filter(r => r.state === 'verification' || r.appointments.some(a => canConfirm('tenant', a)));
  const next = resource.data.flatMap(r => r.appointments.filter(a => a.status !== 'cancelled' && new Date(a.endsAt).getTime() > Date.now()).map(a => ({ r, a })))
    .sort((a, b) => Date.parse(a.a.startsAt) - Date.parse(b.a.startsAt))[0];
  const building = context?.properties[0];
  return <Screen refreshing={resource.loading && resource.data.length > 0} onRefresh={resource.refresh}>
    <Heading eyebrow={t('greeting')} title={t('welcome')} subtitle={building ? `${building.name} · ${building.units.join(', ')}` : t('noAssignment')}
      trailing={<View style={s.avatar}><Icon name="home-outline" /></View>} />
    {!building ? <Notice message={t('noAssignmentHelp')} /> : null}
    <View style={[s.row, { alignItems: 'stretch' }]}><View style={s.metric}><Text style={s.number}>{open.length}</Text><Text style={s.small}>{t('open')}</Text></View>
      <View style={[s.metric, { backgroundColor: colors.lavender }]}><Text style={s.number}>{action.length}</Text><Text style={s.small}>{t('action')}</Text></View></View>
    <Card dark><View style={s.row}><View style={[s.avatar, { backgroundColor: '#2B454E' }]}><Icon name="construct-outline" color={colors.brand} /></View><View style={{ flex: 1 }}><Text style={[s.h3, { color: '#FFFFFF' }]}>{t('reportTitle')}</Text><Text style={[s.small, { color: '#D0DEDC' }]}>{t('reportHelp')}</Text></View></View>
      <Button label={t('quickReport')} icon="add" onPress={() => router.push('/report')} disabled={!building} /></Card>
    {resource.error ? <Notice danger message={resource.error} onRetry={resource.refresh} /> : null}
    {resource.loading && resource.data.length === 0 ? <Loading /> : null}
    {next ? <><Section title={t('nextVisit')} /><Card><View style={s.spread}><Icon name="calendar-outline" color={colors.teal} /><Badge label={next.a.status === 'confirmed' ? t('confirmed') : t('proposed')} tone={next.a.status === 'confirmed' ? 'green' : 'normal'} /></View>
      <Text style={s.h2}>{formatDate(next.a.startsAt, next.a.timezone, language)} · {formatTime(next.a.startsAt, next.a.timezone, language)}</Text><Text style={s.body}>{next.r.title}</Text><Text style={s.small}>{next.a.timezone}</Text>
      <Button label={t('repairDetails')} variant="secondary" onPress={() => router.push({ pathname: '/repair/[id]', params: { id: next.r.id } })} /></Card></> : null}
    <Section title={t('activeRepairs')} action={t('viewAll')} onAction={() => router.push('/repairs')} />
    {open.slice(0, 3).map(repair => <RepairCard key={repair.id} repair={repair} />)}
    {!resource.loading && !resource.error && open.length === 0 ? <Empty title={t('emptyRepairs')} detail={t('emptyHelp')} /> : null}
  </Screen>;
}
