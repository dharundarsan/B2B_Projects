import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { configured, previewEnabled } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { Button, Card, Field, Heading, Icon, Notice, Screen, colors, s } from '../components/ui';

export default function SignIn() {
  const auth = useAuth(); const { t } = useI18n();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    if (!email.includes('@') || !password) { setError(t('invalid')); return; }
    lock.current = true; setBusy(true); setError('');
    try { await auth.signIn(email, password); setPassword(''); } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen>
    <View style={[s.row, { marginTop: 20 }]}><View style={[s.avatar, { backgroundColor: colors.brand }]}><Icon name="business-outline" /></View><Text style={s.h3}>CommunityHub</Text></View>
    <Heading eyebrow="APARTMENT CARE, CONNECTED" title={t('welcome')} subtitle={t('loginHelp')} />
    <Card><Field label={t('email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} />
      <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={() => { void submit(); }} maxLength={200} />
      {error || auth.error ? <Notice message={error || auth.error} danger /> : null}<Button label={t('signIn')} loading={busy} disabled={!configured} onPress={() => { void submit(); }} icon="arrow-forward" /></Card>
    {!configured ? <Notice message="Live sign-in needs apps/mobile/.env with your public Supabase URL/key and API URL. Your manager assigns the account role." /> : null}
    {previewEnabled ? <><Text style={s.eyebrow}>EXPLORE WITH SAMPLE DATA</Text><Button label={t('residentPreview')} variant="secondary" icon="home-outline" onPress={() => auth.enterPreview('tenant')} /><Button label={t('watchmanPreview')} variant="secondary" icon="shield-checkmark-outline" onPress={() => auth.enterPreview('watchman')} /></> : null}
    <Text style={s.small}>{t('offline')}</Text>
  </Screen>;
}
