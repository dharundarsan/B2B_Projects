import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n, statusKey } from '../../lib/i18n';
import { formatDate } from '../../lib/policy';
import { useResource } from '../../hooks/useResource';
import type { CommonIssue } from '../../types';
import { Badge, Button, Card, Empty, Heading, Loading, Notice, Screen, Section, s } from '../../components/ui';

export default function IssueDetails() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { client } = useAuth(); const { t, language } = useI18n();
  const resource = useResource(async signal => (await client.issues(signal)).find(issue => issue.id === id) ?? null, null as CommonIssue | null);
  const issue = resource.data;
  return <Screen refreshing={resource.loading && !!issue} onRefresh={resource.refresh}><Button label={t('back')} variant="secondary" icon="arrow-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/repairs')} />
    {resource.error ? <Notice danger message={resource.error} onRetry={resource.refresh} /> : null}
    {resource.loading && !issue ? <Loading /> : issue ? <><Heading eyebrow={t('shared')} title={issue.title} subtitle={`${issue.propertyName} · ${issue.location}`} /><Badge label={t(statusKey(issue.status))} tone={issue.status === 'resolved' ? 'green' : 'normal'} />
      <Card><Text style={s.label}>{issue.category} · {t(issue.priority === 'urgent' ? 'urgent' : 'routine')}</Text><Text style={s.body}>{issue.description}</Text><Text style={s.small}>{formatDate(issue.createdAt, 'UTC', language)}</Text></Card>
      {issue.resolutionNote ? <><Section title={t('managerUpdate')} /><Card><Text style={s.body}>{issue.resolutionNote}</Text><Text style={s.small}>{formatDate(issue.updatedAt, 'UTC', language)}</Text></Card></> : null}<Notice message={t('publicReport')} /></> : !resource.error ? <Empty title={t('noShared')} /> : null}
  </Screen>;
}
