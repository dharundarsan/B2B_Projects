import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { I18nProvider, useI18n } from '../lib/i18n';
import { isMobileRole } from '../lib/policy';
import { Button, colors, Loading, Notice, s } from '../components/ui';

function Navigation() {
  const auth = useAuth(); const { t } = useI18n();
  if (auth.loading) return <View style={[s.safe, { justifyContent: 'center' }]}><Loading /></View>;
  if ((auth.session || auth.preview) && (!auth.context || !isMobileRole(auth.context.role))) return <View style={[s.safe, { justifyContent: 'center', padding: 26, gap: 20 }]}>
    <Text style={s.h2}>{auth.error || t('unsupported')}</Text><Text style={s.body}>{auth.error ? t('connection') : t('unsupportedHelp')}</Text>
    <Button label={t('refresh')} onPress={auth.refreshContext} />
    <Button label={t('signOut')} variant="secondary" onPress={() => { void auth.signOut().catch(() => auth.refreshContext()); }} />
  </View>;
  const signedIn = !!auth.context && isMobileRole(auth.context.role);
  const scope = JSON.stringify([auth.context?.role, auth.context?.properties.map(p => [p.id, p.units])]);
  return <><StatusBar style="dark" /><Stack key={scope} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Protected guard={!signedIn}><Stack.Screen name="sign-in" /></Stack.Protected>
    <Stack.Protected guard={signedIn}><Stack.Screen name="(tabs)" /><Stack.Screen name="repair/[id]" /><Stack.Screen name="issue/[id]" /></Stack.Protected>
  </Stack></>;
}
export default function RootLayout() {
  return <SafeAreaProvider><I18nProvider><AuthProvider><Navigation /></AuthProvider></I18nProvider></SafeAreaProvider>;
}
