import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { CommonIssue, Repair } from '../types';
import { useI18n, statusKey, repairStatusKey } from '../lib/i18n';
import { Badge, Card, Icon, s } from './ui';

export function RepairCard({ repair }: { repair: Repair }) {
  const { t } = useI18n();
  return <Pressable accessibilityRole="button" accessibilityLabel={repair.title} onPress={() => router.push({ pathname: '/repair/[id]', params: { id: repair.id } })}><Card>
    <View style={s.spread}><Badge label={t(repairStatusKey(repair))} tone={repair.state === 'closed' ? 'green' : 'normal'} />{repair.priority === 'urgent' ? <Badge label={t('urgent')} tone="urgent" /> : <Icon name="arrow-forward" size={18} />}</View>
    <Text style={s.h3}>{repair.title}</Text><Text style={s.small}>{repair.property} · {repair.unit} · {repair.category}</Text>
    <View style={s.divider} /><View style={s.row}><Icon name="time-outline" size={17} /><Text style={[s.small, { flex: 1 }]}>{repair.nextAction}</Text></View>
  </Card></Pressable>;
}
export function IssueCard({ issue }: { issue: CommonIssue }) {
  const { t } = useI18n();
  return <Pressable accessibilityRole="button" accessibilityLabel={issue.title} onPress={() => router.push({ pathname: '/issue/[id]', params: { id: issue.id } })}><Card>
    <View style={s.spread}><Badge label={t(statusKey(issue.status))} tone={issue.status === 'resolved' ? 'green' : 'normal'} />{issue.priority === 'urgent' ? <Badge label={t('urgent')} tone="urgent" /> : <Icon name="arrow-forward" size={18} />}</View>
    <Text style={s.h3}>{issue.title}</Text><View style={s.row}><Icon name="location-outline" size={17} /><Text style={[s.small, { flex: 1 }]}>{issue.propertyName} · {issue.location}</Text></View>
    {issue.resolutionNote ? <Text style={s.body} numberOfLines={2}>{issue.resolutionNote}</Text> : null}
  </Card></Pressable>;
}
