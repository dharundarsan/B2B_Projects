import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ColorValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../providers/AuthProvider';

export const colors = { ink: '#142B35', muted: '#617279', bg: '#F3F6F4', paper: '#FFFFFF', brand: '#C6EF75', navy: '#122C36', line: '#E2E9E5', lavender: '#E9E4F7', danger: '#B84538', dangerBg: '#FCE8E2', teal: '#136655' };
export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 22, color = colors.ink }: { name: IconName; size?: number; color?: ColorValue }) => <Ionicons name={name} size={size} color={color} />;
export function Screen({ children, refreshing = false, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { preview, context, error: accountError, refreshContext } = useAuth(); const { t } = useI18n();
  return <SafeAreaView edges={context ? ['left','right'] : ['top','left','right']} style={s.safe}>
    {preview ? <View style={s.preview}><Text style={s.previewText}>{t('preview')}</Text></View> : null}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.screen}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} /> : undefined}>
        {accountError ? <Notice danger message={accountError} onRetry={refreshContext} /> : null}{children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Heading({ eyebrow, title, subtitle, trailing }: { eyebrow?: string; title: string; subtitle?: string; trailing?: ReactNode }) {
  return <View style={s.heading}><View style={{ flex: 1 }}>{eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}<Text accessibilityRole="header" style={s.h1}>{title}</Text>{subtitle ? <Text style={s.body}>{subtitle}</Text> : null}</View>{trailing}</View>;
}
export const Card = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => <View style={[s.card, dark && s.dark]}>{children}</View>;
export function Button({ label, onPress, icon, variant = 'primary', loading = false, disabled = false }: { label: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean }) {
  const dim = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: dim, busy: loading }} aria-disabled={dim} aria-busy={loading} disabled={dim} onPress={onPress}
    style={({ pressed }) => [s.button, variant === 'secondary' && s.secondary, variant === 'danger' && s.danger, dim && { opacity: 0.45 }, pressed && { opacity: 0.78 }]}>
    {loading ? <ActivityIndicator color={colors.ink} /> : icon ? <Icon name={icon} size={20} color={variant === 'danger' ? colors.danger : colors.ink} /> : null}
    <Text style={[s.buttonText, variant === 'danger' && { color: colors.danger }]}>{label}</Text>
  </Pressable>;
}
export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View accessibilityRole="radiogroup" style={s.chips}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} aria-checked={value === option.value} onPress={() => onChange(option.value)} style={[s.chip, value === option.value && s.selectedChip]}><Text style={[s.chipText, value === option.value && { color: '#FFFFFF' }]}>{option.label}</Text></Pressable>)}</View>;
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor="#76858B" style={[s.input, props.multiline && { minHeight: 112, textAlignVertical: 'top' }, props.style]} />{hint ? <Text style={s.small}>{hint}</Text> : null}</View>;
}
export function Notice({ message, onRetry, danger = false }: { message: string; onRetry?: () => void; danger?: boolean }) {
  const { t } = useI18n();
  return <View accessibilityRole={danger ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.notice, danger && { backgroundColor: colors.dangerBg }]}><Icon name={danger ? 'alert-circle-outline' : 'information-circle-outline'} size={20} /><View style={{ flex: 1 }}><Text style={s.noticeText}>{message}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>{t('retry')}</Text></Pressable> : null}</View></View>;
}
export function Empty({ title, detail, icon = 'checkmark-circle-outline' }: { title: string; detail?: string; icon?: IconName }) {
  return <View style={s.empty}><View style={s.emptyIcon}><Icon name={icon} size={30} color={colors.teal} /></View><Text style={[s.h3, { textAlign: 'center' }]}>{title}</Text>{detail ? <Text style={[s.body, { textAlign: 'center' }]}>{detail}</Text> : null}</View>;
}
export const Loading = () => { const { t } = useI18n(); return <View style={s.empty}><ActivityIndicator color={colors.teal} /><Text style={s.small}>{t('loading')}</Text></View>; };
export const Badge = ({ label, tone = 'normal' }: { label: string; tone?: 'normal' | 'urgent' | 'green' }) => <View style={[s.badge, tone === 'urgent' && { backgroundColor: colors.dangerBg }, tone === 'green' && { backgroundColor: '#E2F2D8' }]}><Text style={[s.badgeText, tone === 'urgent' && { color: colors.danger }]}>{label}</Text></View>;
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={s.section}><Text accessibilityRole="header" style={[s.h3, { flex: 1 }]}>{title}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={s.sectionAction}><Text style={s.link}>{action}</Text><Icon name="arrow-forward" size={16} /></Pressable> : null}</View>;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, screen: { padding: 22, paddingBottom: 38, gap: 18, width: '100%', maxWidth: 780, alignSelf: 'center' },
  preview: { backgroundColor: '#F4E5B5', padding: 8 }, previewText: { fontSize: 11, fontWeight: '600', color: '#524526', textAlign: 'center' },
  heading: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 8 }, eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '800', color: colors.muted, marginBottom: 8 },
  h1: { fontSize: 30, lineHeight: 36, letterSpacing: -0.9, fontWeight: '800', color: colors.ink }, h2: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontWeight: '700', color: colors.ink }, h3: { fontSize: 17, fontWeight: '700', lineHeight: 24, color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 5 }, small: { fontSize: 12, lineHeight: 19, color: colors.muted }, label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.line, gap: 12 }, dark: { backgroundColor: colors.navy, borderColor: colors.navy },
  button: { backgroundColor: colors.brand, borderRadius: 16, minHeight: 52, paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, buttonText: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.ink, flexShrink: 1, textAlign: 'center' },
  secondary: { backgroundColor: '#EEF2EF', borderWidth: 1, borderColor: colors.line }, danger: { backgroundColor: colors.dangerBg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 30, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' }, selectedChip: { backgroundColor: colors.navy, borderColor: colors.navy }, chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  field: { gap: 8 }, input: { minHeight: 52, borderWidth: 1, borderColor: '#CCD9D2', borderRadius: 15, backgroundColor: colors.paper, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.ink },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#EAF0ED', padding: 16, borderRadius: 16 }, noticeText: { fontSize: 13, lineHeight: 21, color: colors.ink },
  empty: { padding: 28, gap: 12, alignItems: 'center' }, emptyIcon: { backgroundColor: '#E3F0DD', padding: 16, borderRadius: 24 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start', backgroundColor: colors.lavender }, badgeText: { fontSize: 11, lineHeight: 17, fontWeight: '700', color: colors.ink },
  section: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }, sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }, link: { fontSize: 13, fontWeight: '700', color: colors.teal },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, divider: { height: 1, backgroundColor: colors.line, marginVertical: 6 },
  metric: { flex: 1, backgroundColor: colors.paper, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line, minHeight: 102 }, number: { fontSize: 28, fontWeight: '800', color: colors.ink }, avatar: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }
});
