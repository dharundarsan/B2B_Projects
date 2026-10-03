import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { api } from './api';
import { assertImage } from './policy';

export interface Photo { uri: string; name: string; contentType: 'image/jpeg'; size: number }
export async function pickPhoto(camera: boolean): Promise<Photo | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera permission is needed to take a photo.');
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.assets?.[0]; if (result.canceled || !asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1920) context.resize(asset.width >= asset.height ? { width: 1920 } : { height: 1920 });
  const image = await context.renderAsync();
  const normalized = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  image.release(); context.release();
  const size = Platform.OS === 'web' ? (await (await fetch(normalized.uri)).blob()).size : new File(normalized.uri).size;
  assertImage('image/jpeg', size);
  return { uri: normalized.uri, name: 'repair-photo-' + Date.now() + '.jpg', contentType: 'image/jpeg', size };
}
export async function uploadPhoto(client: typeof api, requestId: string, photo: Photo) {
  assertImage(photo.contentType, photo.size);
  const bytes = Platform.OS === 'web' ? await (await fetch(photo.uri)).arrayBuffer() : await new File(photo.uri).arrayBuffer();
  assertImage(photo.contentType, bytes.byteLength);
  const ticket = await client.uploadUrl({ requestId, name: photo.name, contentType: photo.contentType, size: bytes.byteLength });
  const expected = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://invalid.example').origin;
  if (new URL(ticket.signedUrl).origin !== expected) throw new Error('The upload destination does not match your Supabase project.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(ticket.signedUrl, { method: 'PUT', headers: { 'Content-Type': photo.contentType, 'x-upsert': 'false' }, body: bytes, signal: controller.signal });
    if (!response.ok) throw new Error('The repair is saved, but the photo upload failed. Please retry the attachment.');
    await client.completeUpload(requestId, ticket.evidenceId);
  } finally { clearTimeout(timeout); }
}
