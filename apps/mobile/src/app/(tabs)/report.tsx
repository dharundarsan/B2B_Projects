import { useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../../providers/AuthProvider';
import { useI18n, languageNames } from '../../lib/i18n';
import { canReport } from '../../lib/policy';
import { ApiError } from '../../lib/api';
import { uploadPhoto, type Photo } from '../../lib/photos';
import { Badge, Button, Card, Chips, Field, Heading, Icon, Notice, Screen, Section, colors, s } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';

export default function Report() {
  const { client, context, preview } = useAuth(); const { t, language } = useI18n(); const watchman = context?.role === 'watchman';
  const [kind, setKind] = useState<'apartment' | 'common'>(watchman ? 'common' : 'apartment');
  const [propertyId, setPropertyId] = useState(context?.properties[0]?.id ?? ''); const property = context?.properties.find(p => p.id === propertyId);
  const [unit, setUnit] = useState(property?.units[0] ?? ''); const [location, setLocation] = useState(''); const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Plumbing'); const [description, setDescription] = useState(''); const [name, setName] = useState(context?.email.split('@')[0] ?? '');
  const [hazard, setHazard] = useState(false); const [priority, setPriority] = useState<'routine' | 'urgent'>('routine'); const [access, setAccess] = useState('Resident must be home');
  const [accessNotes, setAccessNotes] = useState(''); const [preferredWindow, setPreferred] = useState(''); const [photo, setPhoto] = useState<Photo | null>(null);
  const [step, setStep] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [ambiguous, setAmbiguous] = useState(false);
  const [saved, setSaved] = useState<{ id: string; kind: 'apartment' | 'common'; photoError: boolean } | null>(null);
  const lock = useRef(false); const submission = useRef<{ fingerprint: string; id: string } | null>(null);
  const effectivePriority = hazard ? 'urgent' : priority;
  const valid = canReport(context, propertyId, kind === 'apartment' ? unit : undefined) && title.trim().length >= 3 && description.trim().length >= 3
    && (kind === 'common' ? location.trim().length >= 2 : name.trim().length > 0);
  const reset = () => { setSaved(null); setStep(1); setTitle(''); setDescription(''); setLocation(''); setAccessNotes(''); setPreferred(''); setHazard(false); setPriority('routine'); setPhoto(null); setError(''); setAmbiguous(false); submission.current = null; };
  const openSaved = () => { if (!saved) return; const path = saved.kind === 'apartment' ? '/repair/[id]' : '/issue/[id]'; const id = saved.id; reset(); router.push({ pathname: path, params: { id } }); };
  const submit = async () => {
    if (lock.current || !valid || ambiguous || saved) return; lock.current = true; setBusy(true); setError('');
    try {
      if (kind === 'common') {
        const payload = { propertyId, location: location.trim(), title: title.trim(), category, description: description.trim(), priority: effectivePriority };
        const fingerprint = JSON.stringify(payload); if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, id: Crypto.randomUUID() };
        const issue = await client.reportCommon({ ...payload, submissionId: submission.current.id }); setSaved({ id: issue.id, kind, photoError: false });
      } else {
        const repair = await client.create({ propertyId, unit, title: title.trim(), category, description: description.trim(), resident: name.trim(), priority: effectivePriority,
          language: languageNames[language], access, accessNotes: accessNotes.trim(), preferredWindow: preferredWindow.trim(), safetyAnswers: hazard ? { immediateHazard: 'Yes' } : {} });
        let photoError = false; if (photo) try { await uploadPhoto(client, repair.id, photo); } catch { photoError = true; }
        setSaved({ id: repair.id, kind, photoError });
      }
    } catch (err) { setError(err instanceof Error ? err.message : t('invalid')); if (kind === 'apartment' && err instanceof ApiError && err.status === 0) setAmbiguous(true); }
    finally { lock.current = false; setBusy(false); }
  };
  if (saved) return <Screen><Heading title={t('reportSaved')} subtitle={t('savedHelp')} /><Card><Icon name="checkmark-circle" size={48} color={colors.teal} /><Text style={s.h2}>{title}</Text><Text style={s.body}>{property?.name} · {kind === 'apartment' ? unit : location}</Text><Badge label={t('submitted')} /></Card>
    {saved.photoError ? <Notice danger message={t('uploadFail')} /> : null}<Button label={t('repairDetails')} onPress={openSaved} icon="arrow-forward" /><Button label={t('quickReport')} variant="secondary" onPress={reset} /></Screen>;
  return <Screen><Heading eyebrow={`${t('report')} · ${step}/2`} title={step === 1 ? t('reportTitle') : t('review')} subtitle={t('reportHelp')} />
    {!context?.properties.length ? <Notice message={t('noAssignmentHelp')} /> : null}
    {step === 1 ? <>
      {!watchman ? <Chips value={kind} onChange={value => { setKind(value); setPhoto(null); }} options={[{ value: 'apartment', label: t('apartment') }, { value: 'common', label: t('common') }]} /> : <Badge label={t('common')} />}
      <Section title={t('building')} /><Chips value={propertyId} onChange={id => { setPropertyId(id); setUnit(context?.properties.find(p => p.id === id)?.units[0] ?? ''); }} options={context?.properties.map(p => ({ value: p.id, label: p.name })) ?? []} />
      {kind === 'apartment' ? <><Section title={t('unit')} /><Chips value={unit} onChange={setUnit} options={property?.units.map(value => ({ value, label: value })) ?? []} /><Field label={t('name')} value={name} onChangeText={setName} maxLength={160} /></>
        : <><Notice message={t('publicReport')} /><Field label={t('location')} hint={t('locationHint')} value={location} onChangeText={setLocation} maxLength={160} /></>}
      <Field label={t('title')} value={title} onChangeText={setTitle} maxLength={200} /><Section title={t('category')} />
      <Chips value={category} onChange={setCategory} options={['Plumbing', 'Electrical', 'Appliance', 'Structural', 'Cleaning', 'Other'].map(value => ({ value, label: value }))} />
      <Field label={t('details')} value={description} onChangeText={setDescription} multiline maxLength={4000} />
      <Chips value={priority} onChange={setPriority} options={[{ value: 'routine', label: t('routine') }, { value: 'urgent', label: t('urgent') }]} />
      <Card><Text style={s.h3}>{t('safety')}</Text><View style={s.spread}><Text style={[s.body, { flex: 1 }]}>{t('danger')}</Text><Switch accessibilityLabel={t('danger')} value={hazard} onValueChange={setHazard} trackColor={{ true: colors.teal }} /></View><Text style={s.small}>{t('safetyHelp')}</Text></Card>
      {kind === 'apartment' ? <><Section title={t('access')} /><Chips value={access} onChange={setAccess} options={[{ value: 'Resident must be home', label: t('atHome') }, { value: 'Contact resident before access', label: t('contactFirst') }]} />
        <Field label={t('accessNotes')} hint={t('accessHelp')} value={accessNotes} onChangeText={setAccessNotes} maxLength={1000} /><Field label={t('preferred')} value={preferredWindow} onChangeText={setPreferred} maxLength={200} />
        <Section title={t('photos')} />{preview ? <Text style={s.small}>{t('noPhotoPreview')}</Text> : <><PhotoPicker photo={photo} onChange={setPhoto} disabled={busy} /><Text style={s.small}>{t('photoHelp')}</Text></>}
      </> : null}
      <Button label={t('review')} disabled={!valid || ambiguous} icon="arrow-forward" onPress={() => { setError(''); setStep(2); }} />
    </> : <><Card><Badge label={t(effectivePriority === 'urgent' ? 'urgent' : 'routine')} tone={effectivePriority === 'urgent' ? 'urgent' : 'normal'} /><Text style={s.h2}>{title}</Text>
      <Text style={s.body}>{property?.name} · {kind === 'apartment' ? unit : location}</Text><Text style={s.label}>{category}</Text><Text style={s.body}>{description}</Text>
      {kind === 'apartment' ? <><View style={s.divider} /><Text style={s.small}>{access}</Text>{accessNotes ? <Text style={s.small}>{accessNotes}</Text> : null}{preferredWindow ? <Text style={s.small}>{preferredWindow}</Text> : null}{photo ? <Text style={s.small}>{t('photos')}: 1</Text> : null}</> : null}</Card>
      <Notice message={kind === 'common' ? t('publicReport') : t('accessHelp')} /><Button label={t('submit')} loading={busy} disabled={!valid || ambiguous} icon="checkmark" onPress={() => { void submit(); }} /><Button label={t('back')} variant="secondary" disabled={busy} onPress={() => setStep(1)} /></>}
    {error ? <Notice danger message={error} /> : null}{ambiguous ? <Button label={t('viewAll')} variant="secondary" onPress={() => router.push('/repairs')} /> : null}
    <Text style={s.small}>{t('offline')}</Text>
  </Screen>;
}
