import { useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n } from '../../lib/i18n';
import { isOpen } from '../../lib/policy';
import { useResource } from '../../hooks/useResource';
import type { CommonIssue, Repair } from '../../types';
import { Chips, Empty, Field, Heading, Loading, Notice, Screen } from '../../components/ui';
import { IssueCard, RepairCard } from '../../components/RepairCard';

export default function Reports() {
  const { context, client } = useAuth(); const { t } = useI18n(); const watchman = context?.role === 'watchman';
  const [section, setSection] = useState(watchman ? 'shared' : 'home'); const [filter, setFilter] = useState('open'); const [search, setSearch] = useState('');
  const resource = useResource(async signal => {
    const [repairs, issues] = await Promise.all([watchman ? Promise.resolve([] as Repair[]) : client.repairs(signal), client.issues(signal)]);
    return { repairs, issues };
  }, { repairs: [] as Repair[], issues: [] as CommonIssue[] });
  const needle = search.trim().toLocaleLowerCase();
  const repairs = resource.data.repairs.filter(r => (filter === 'all' || (filter === 'open' ? isOpen(r) : !isOpen(r))) && `${r.title} ${r.category} ${r.unit}`.toLocaleLowerCase().includes(needle));
  const issues = resource.data.issues.filter(i => (filter === 'all' || (filter === 'open' ? i.status !== 'resolved' : i.status === 'resolved')) && `${i.title} ${i.location} ${i.propertyName}`.toLocaleLowerCase().includes(needle));
  return <Screen refreshing={resource.loading} onRefresh={resource.refresh}>
    <Heading title={watchman ? t('sharedTitle') : t('repairs')} />
    {!watchman ? <Chips value={section} onChange={setSection} options={[{ value: 'home', label: t('myHome') }, { value: 'shared', label: t('shared') }]} /> : null}
    <Field label={t('search')} value={search} onChangeText={setSearch} placeholder={t('search')} maxLength={200} />
    <Chips value={filter} onChange={setFilter} options={[{ value: 'open', label: t('open') }, { value: 'history', label: t('history') }, { value: 'all', label: t('all') }]} />
    {resource.error ? <Notice danger message={resource.error} onRetry={resource.refresh} /> : null}
    {resource.loading && !resource.data.repairs.length && !resource.data.issues.length ? <Loading /> : null}
    {section === 'home' && !watchman ? repairs.map(r => <RepairCard key={r.id} repair={r} />) : issues.map(i => <IssueCard key={i.id} issue={i} />)}
    {!resource.loading && !resource.error && (section === 'home' ? !repairs.length : !issues.length) ? <Empty title={section === 'home' ? t('emptyRepairs') : t('noShared')} detail={t('emptyHelp')} /> : null}
  </Screen>;
}
