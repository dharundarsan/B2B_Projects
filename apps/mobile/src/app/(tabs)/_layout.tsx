import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n } from '../../lib/i18n';
import { colors, Icon } from '../../components/ui';

export default function TabLayout() {
  const { context } = useAuth(); const { t } = useI18n(); const watchman = context?.role === 'watchman'; const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.teal, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: 72 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom) }, tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: watchman ? t('visits') : t('home'), tabBarIcon: ({ color }) => <Icon name={watchman ? 'shield-checkmark-outline' : 'home-outline'} color={color} /> }} />
    <Tabs.Screen name="repairs" options={{ title: watchman ? t('shared') : t('repairs'), tabBarIcon: ({ color }) => <Icon name="albums-outline" color={color} /> }} />
    <Tabs.Screen name="report" options={{ title: t('report'), tabBarIcon: ({ color }) => <Icon name="add-circle-outline" color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: ({ color }) => <Icon name="person-circle-outline" color={color} /> }} />
  </Tabs>;
}
