import { useRef, useState } from 'react';
import { Image, Linking, Modal, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n, repairStatusKey } from '../../lib/i18n';
import { canConfirm, canVerify, formatDate, formatTime, isOpen } from '../../lib/policy';
import { uploadPhoto, type Photo } from '../../lib/photos';
import { useResource } from '../../hooks/useResource';
import type { Message, Repair } from '../../types';
import { Badge, Button, Card, Chips, Empty, Field, Heading, Icon, Loading, Notice, Screen, Section, colors, s } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Confirmation } from '../../components/Confirmation';

export default function RepairDetails() {
  const { id, photoError } = useLocalSearchParams<{ id: string; photoError?: string }>();
  const { client, context, preview } = useAuth(); const { t, language } = useI18n();
  const resource = useResource(async signal => {
    if (context?.role !== 'tenant') throw new Error(t('watchmanPrivacy'));
    const [repair, messages] = await Promise.all([client.repair(id, signal), client.messages(id, signal)]); return { repair, messages };
  }, { repair: null as Repair | null, messages: [] as Message[] });
  const repair = resource.data.repair;
  const [tab, setTab] = useState('overview'); const [body, setBody] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [confirmation, setConfirmation] = useState<'fixed' | 'unresolved' | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null); const [showPicker, setShowPicker] = useState(false); const [photoUrl, setPhotoUrl] = useState(''); const lock = useRef(false);
  const mutate = async (work: () => Promise<unknown>, success?: () => void) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await work(); success?.(); resource.refresh(); } catch (err) { setError(err instanceof Error ? err.message : t('invalid')); resource.refresh(); }
    finally { lock.current = false; setBusy(false); setConfirmation(null); }
  };
  return <Screen refreshing={resource.loading && !!repair} onRefresh={resource.refresh}><Button label={t('back')} icon="arrow-back" variant="secondary" onPress={() => router.canGoBack() ? router.back() : router.replace('/repairs')} />
    {resource.error ? <Notice danger message={resource.error} onRetry={resource.refresh} /> : null}{error ? <Notice danger message={error} /> : null}
    {photoError ? <Notice danger message={t('uploadFail')} /> : null}
    {resource.loading && !repair ? <Loading /> : repair ? <>
      <Heading eyebrow={`${repair.property} · ${repair.unit}`} title={repair.title} subtitle={repair.category} /><View style={s.row}><Badge label={t(repairStatusKey(repair))} tone={repair.state === 'closed' ? 'green' : 'normal'} />{repair.priority === 'urgent' ? <Badge label={t('urgent')} tone="urgent" /> : null}</View>
      <Chips value={tab} onChange={setTab} options={[{ value: 'overview', label: t('repairDetails') }, { value: 'messages', label: t('messages') }, { value: 'timeline', label: t('timeline') }]} />
      {tab === 'overview' ? <><Card dark><Text style={[s.eyebrow, { color: colors.brand }]}>{t('nextAction')}</Text><Text style={[s.h3, { color: '#FFFFFF' }]}>{repair.nextAction}</Text></Card>
        {canVerify(context?.role ?? '', repair) ? <Card><Text style={s.eyebrow}>{t('yourResponse')}</Text><Text style={s.h3}>{t('verifyHelp')}</Text><Field label={t('note')} value={note} onChangeText={setNote} multiline maxLength={1000} />
          <Button label={t('fixed')} icon="checkmark-circle-outline" disabled={busy} onPress={() => setConfirmation('fixed')} /><Button label={t('notFixed')} variant="danger" disabled={busy} onPress={() => { if (note.trim().length < 3) setError(t('noteNeeded')); else setConfirmation('unresolved'); }} /></Card> : null}
        {repair.appointments.filter(a => a.status !== 'cancelled').map(visit => <Card key={visit.id}><View style={s.row}><Icon name="calendar-outline" color={colors.teal} /><Text style={s.h3}>{formatDate(visit.startsAt, visit.timezone, language)}</Text></View>
          <Text style={s.h2}>{formatTime(visit.startsAt, visit.timezone, language)} – {formatTime(visit.endsAt, visit.timezone, language)}</Text><Text style={s.small}>{visit.timezone}</Text>
          <Badge label={visit.status === 'confirmed' ? t('confirmed') : t('proposed')} tone={visit.status === 'confirmed' ? 'green' : 'normal'} />
          <Text style={s.small}>{t('resident')}: {visit.residentConfirmedAt ? '✓' : '—'} · Vendor: {visit.vendorConfirmedAt ? '✓' : '—'}</Text>
          {isOpen(repair) && canConfirm(context?.role ?? '', visit) ? <><Button label={t('confirmVisit')} disabled={busy} onPress={() => { void mutate(() => client.confirm(repair, visit.id, true)); }} /><Button label={t('declineVisit')} variant="secondary" disabled={busy} onPress={() => { void mutate(() => client.confirm(repair, visit.id, false)); }} /></> : null}
        </Card>)}
        <Section title={t('details')} /><Card><Text style={s.body}>{repair.description}</Text><View style={s.divider} /><Text style={s.small}>{repair.access}</Text><Text style={s.small}>{formatDate(repair.createdAt, repair.timezone, language)}</Text></Card>
        <Section title={t('photos')} />{repair.evidence.filter(e => e.status === 'uploaded').map(evidence => <Button key={evidence.id} variant="secondary" label={`${t('viewPhoto')}: ${evidence.name}`} icon="image-outline" disabled={busy} onPress={() => { void mutate(async () => { const value = await client.evidenceUrl(repair.id, evidence.id); if (evidence.contentType.startsWith('image/')) setPhotoUrl(value.url); else await Linking.openURL(value.url); }); }} />)}
        {preview ? <Text style={s.small}>{t('noPhotoPreview')}</Text> : <><Button label={t('attach')} variant="secondary" icon="add" disabled={busy} onPress={() => setShowPicker(value => !value)} />
          {showPicker ? <><PhotoPicker photo={photo} onChange={setPhoto} disabled={busy} /><Text style={s.small}>{t('photoHelp')}</Text>{photo ? <Button label={t('attach')} loading={busy} onPress={() => { void mutate(() => uploadPhoto(client, repair.id, photo), () => { setPhoto(null); setShowPicker(false); }); }} /> : null}</> : null}</>}
      </> : tab === 'messages' ? <><Notice message={t('messageHelp')} />{resource.data.messages.map(message => <Card key={message.id}><View style={s.spread}><Badge label={message.role === 'resident' ? t('resident') : message.role} /><Text style={s.small}>{formatTime(message.at, repair.timezone, language)}</Text></View><Text style={[s.small, { fontWeight: '600' }]}>{message.sender}</Text><Text style={[s.body, { color: colors.ink }]}>{message.body}</Text></Card>)}
        <Field label={t('messages')} placeholder={t('messageHint')} value={body} onChangeText={setBody} maxLength={4000} multiline /><Button label={t('send')} icon="send-outline" loading={busy} disabled={!body.trim()} onPress={() => { const text = body.trim(); if (text) void mutate(() => client.send(repair.id, text), () => setBody('')); }} />
      </> : <>{repair.events.map(event => <View key={event.id} style={[s.row, { alignItems: 'flex-start' }]}><View style={[s.avatar, { width: 36, height: 36, borderRadius: 12 }]}><Icon name="checkmark" size={18} /></View><View style={{ flex: 1, paddingBottom: 16 }}><Text style={s.h3}>{event.label}</Text><Text style={s.body}>{event.detail}</Text><Text style={s.small}>{formatDate(event.at, repair.timezone, language)} · {formatTime(event.at, repair.timezone, language)}</Text></View></View>)}</>}
      <Text style={s.small}>{t('offline')}</Text>
      {confirmation ? <Confirmation title={confirmation === 'fixed' ? t('fixed') : t('notFixed')} detail={confirmation === 'fixed' ? repair.title : note} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => { void mutate(() => client.verify(repair, confirmation === 'fixed', note.trim()), () => setNote('')); }} /> : null}
    </> : !resource.error ? <Empty title={t('emptyRepairs')} /> : null}
    <Modal visible={!!photoUrl} animationType="slide" onRequestClose={() => setPhotoUrl('')}><View style={[s.safe, { padding: 24, paddingTop: 60, justifyContent: 'center', gap: 20 }]}><Image source={{ uri: photoUrl }} accessibilityLabel={t('photos')} style={{ width: '100%', height: 380 }} resizeMode="contain" /><Button label={t('back')} variant="secondary" onPress={() => setPhotoUrl('')} /></View></Modal>
  </Screen>;
}
