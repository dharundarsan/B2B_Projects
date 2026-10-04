import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n, languageNames } from '../../lib/i18n';
import { Badge, Button, Card, Chips, Heading, Icon, Notice, Screen, Section, s } from '../../components/ui';
import type { Language } from '../../types';

export default function Profile() {
  const auth = useAuth(); const { t, language, setLanguage } = useI18n(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <Screen><Heading title={t('profile')} /><Card><View style={s.row}><View style={s.avatar}><Icon name="person-outline" /></View><View style={{ flex: 1 }}><Text style={s.h3}>{auth.context?.email}</Text><Badge label={auth.context?.canSwitchContext ? (auth.context.userContext===2?'Administrator':'Community member') : auth.context?.role === 'watchman' ? t('watchman') : t('resident')} /></View></View></Card>
    <Section title={t('language')} /><Chips<Language> value={language} onChange={setLanguage} options={(Object.keys(languageNames) as Language[]).map(value => ({ value, label: languageNames[value] }))} /><Text style={s.small}>{t('languageHelp')} (Hindi / Tamil: navigation and key actions; longer help uses English.)</Text>
    <Section title={t('assigned')} /><Card>{auth.context?.properties.map(property => <View key={property.id}><Text style={s.h3}>{property.name}</Text><Text style={s.small}>{property.units.join(' · ') || t('shared')} · {property.timezone}</Text></View>)}{!auth.context?.properties.length ? <Notice message={t('noAssignmentHelp')} /> : null}</Card>
    <Section title={t('privacy')} /><Notice message={auth.context?.role === 'watchman' ? t('watchmanPrivacy') : t('residentPrivacy')} />
    <Section title={t('connection')} /><Text style={s.small}>{process.env.EXPO_PUBLIC_API_URL || 'Not configured'}</Text><Notice message={t('offline')} /><Text style={s.small}>{t('settingsHelp')}</Text>
    {error ? <Notice danger message={error} /> : null}<Button label={t('refresh')} variant="secondary" onPress={auth.refreshContext} icon="refresh" />
    <Button label={t('signOut')} variant="danger" loading={busy} onPress={() => { setBusy(true); setError(''); void auth.signOut().catch(err => setError(err instanceof Error ? err.message : 'Could not sign out.')).finally(() => setBusy(false)); }} icon="log-out-outline" />
  </Screen>;
}
