import { Modal, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { Button, Card, colors, s } from './ui';

export function Confirmation({ title, detail, busy, onConfirm, onCancel }: { title: string; detail: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}><View style={{ flex: 1, backgroundColor: '#122C36B3', justifyContent: 'center', padding: 24 }}>
    <View accessibilityViewIsModal style={{ maxWidth: 480, width: '100%', alignSelf: 'center' }}><Card><Text accessibilityRole="header" style={s.h2}>{title}</Text><Text style={s.body}>{detail}</Text>
      <Button label={t('confirm')} loading={busy} onPress={onConfirm} /><Button label={t('cancel')} variant="secondary" disabled={busy} onPress={onCancel} /></Card></View>
  </View></Modal>;
}
