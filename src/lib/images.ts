import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ToBytes } from './base64';

async function resizeToBase64(uri: string, width: number, compress: number): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const saved = await ref.saveAsync({ base64: true, compress, format: SaveFormat.JPEG });
  if (!saved.base64) throw new Error('Falha ao processar a imagem.');
  return saved.base64;
}

/** Gera a foto enviada para a IA e os BLOBs guardados no histórico. */
export async function preparePhoto(uri: string) {
  const [imageBase64, thumbBase64] = await Promise.all([resizeToBase64(uri, 1024, 0.7), resizeToBase64(uri, 240, 0.6)]);
  return { imageBase64, image: base64ToBytes(imageBase64), thumbnail: base64ToBytes(thumbBase64) };
}
