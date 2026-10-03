import { useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { pickPhoto, type Photo } from '../lib/photos';
import { Button, Notice, s } from './ui';

export function PhotoPicker({ photo, onChange, disabled = false }: { photo: Photo | null; onChange: (photo: Photo | null) => void; disabled?: boolean }) {
  const { t } = useI18n(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const choose = async (camera: boolean) => {
    if (lock.current || disabled) return; lock.current = true; setBusy(true); setError('');
    try { const next = await pickPhoto(camera); if (next) onChange(next); } catch (err) { setError(err instanceof Error ? err.message : t('permission')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}>{photo ? <Image accessibilityLabel={t('photos')} source={{ uri: photo.uri }} style={{ width: '100%', height: 190, borderRadius: 18 }} resizeMode="cover" /> : null}
    <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}><View style={{ flex: 1, minWidth: 120 }}><Button variant="secondary" label={t('camera')} icon="camera-outline" loading={busy} disabled={disabled} onPress={() => { void choose(true); }} /></View><View style={{ flex: 1, minWidth: 120 }}><Button variant="secondary" label={t('library')} icon="image-outline" disabled={disabled || busy} onPress={() => { void choose(false); }} /></View></View>
    {photo ? <Button label={t('cancel')} variant="secondary" disabled={busy || disabled} onPress={() => onChange(null)} /> : null}
    {error ? <Notice danger message={error} /> : null}
  </View>;
}
