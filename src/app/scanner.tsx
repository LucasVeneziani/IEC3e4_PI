import { Ionicons } from '@expo/vector-icons';
import { type BarcodeScanningResult, type BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router, useFocusEffect, useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_BAR_HEIGHT, BottomBar } from '@/components/BottomBar';
import { lookupBarcode, scanClothing } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { preparePhoto } from '@/lib/images';
import { getLatestScan, insertScan } from '@/lib/scans';
import type { ClothingInfo, ScanSummary } from '@/lib/types';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr', 'datamatrix'];
/** Por quanto tempo um código detectado continua sendo oferecido depois que a câmera deixa de vê-lo. */
const CODE_HOLD_MS = 4000;

type DetectedCode = { data: string; type: string; seenAt: number };

/** Alguns aparelhos falham na primeira captura logo após focar; tenta mais uma vez antes de desistir. */
async function takePicture(cam: CameraView) {
  try {
    return await cam.takePictureAsync({ quality: 0.8 });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return await cam.takePictureAsync({ quality: 0.8 });
  }
}

function describeCode(code: DetectedCode) {
  const isQr = code.type === 'qr' || code.type === 'datamatrix' || code.type === '256';
  const text = code.data.length > 32 ? `${code.data.slice(0, 30)}…` : code.data;
  return { label: isQr ? 'QR code' : 'Código de barras', text, icon: isQr ? ('qr-code-outline' as const) : ('barcode-outline' as const) };
}

export default function ScannerScreen() {
  const db = useSQLiteContext();
  const { user, logout } = useAuth();
  const [permission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [torch, setTorch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  // Refs (e não props) controlam a leitura de códigos: no Android, mudar a prop onBarcodeScanned faz o
  // expo-camera religar a câmera, e uma foto em andamento falha com "Failed to capture image".
  const scanningPaused = useRef(false);
  const [latest, setLatest] = useState<ScanSummary | null>(null);
  const [detected, setDetected] = useState<DetectedCode | null>(null);
  const focused = useIsFocused();

  useFocusEffect(
    useCallback(() => {
      if (user) getLatestScan(db, user.id).then(setLatest);
    }, [db, user]),
  );

  // Esquece o código quando a câmera passa um tempo sem vê-lo.
  useEffect(() => {
    if (!detected) return;
    const timer = setTimeout(() => setDetected(null), CODE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [detected]);

  useEffect(() => {
    scanningPaused.current = busy || !focused;
  }, [busy, focused]);

  // No Android, a prévia da câmera às vezes volta com o tamanho errado (só metade da tela) depois que uma
  // sobreposição a cobre. Remontar a câmera ao voltar para esta tela garante a prévia em tela cheia.
  const [cameraKey, setCameraKey] = useState(0);
  const wasBlurred = useRef(false);
  useEffect(() => {
    if (!focused) {
      wasBlurred.current = true;
    } else if (wasBlurred.current) {
      wasBlurred.current = false;
      setCameraReady(false);
      setCameraKey((k) => k + 1);
    }
  }, [focused]);

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!result.data || scanningPaused.current) return;
    setDetected((prev) =>
      // Evita renderizar de novo a cada quadro para o mesmo código.
      prev && prev.data === result.data && Date.now() - prev.seenAt < 1000
        ? prev
        : { data: result.data, type: String(result.type), seenAt: Date.now() },
    );
  }, []);

  /** Tira a foto (sempre guardada no histórico) e deixa `identify` decidir qual rota do backend chamar. */
  const run = useCallback(
    async (identify: (imageBase64: string) => Promise<ClothingInfo>) => {
      if (!user || !camera.current || busy || !cameraReady) return;
      scanningPaused.current = true;
      setBusy(true);
      try {
        const photo = await takePicture(camera.current);
        const { imageBase64, image, thumbnail } = await preparePhoto(photo.uri);
        const info = await identify(imageBase64);
        setDetected(null);
        const id = await insertScan(db, user.id, image, thumbnail, info);
        setLatest(await getLatestScan(db, user.id));
        router.push({ pathname: '/result/[id]', params: { id: String(id) } });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (Platform.OS === 'web') window.alert(`Não foi possível escanear: ${message}`);
        else Alert.alert('Não foi possível escanear', message);
      } finally {
        setBusy(false);
      }
    },
    [busy, cameraReady, db, user],
  );

  const scan = useCallback(() => run((imageBase64) => scanClothing(imageBase64)), [run]);
  const lookupDetected = useCallback(() => {
    if (!detected) return;
    const { data, type } = detected;
    run((imageBase64) => lookupBarcode(data, type, imageBase64));
  }, [detected, run]);

  if (!user) return <Redirect href="/login" />;
  if (permission && !permission.granted) return <Redirect href="/permission" />;

  const thumbUri = latest?.thumbnailUri;
  const controlsBottom = BOTTOM_BAR_HEIGHT + insets.bottom + 28;

  return (
    <View style={styles.root}>
      <CameraView
        key={cameraKey}
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onCameraReady={() => setCameraReady(true)}
        onBarcodeScanned={onBarcodeScanned}
      />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable onPress={() => setTorch((t) => !t)} hitSlop={12} accessibilityLabel={torch ? 'Desligar flash' : 'Ligar flash'}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={26} color="#fff" style={styles.shadow} />
        </Pressable>
        <Pressable onPress={() => setMenuOpen((o) => !o)} hitSlop={12} accessibilityLabel="Mais opções">
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" style={styles.shadow} />
        </Pressable>
      </View>

      {menuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menu, { top: insets.top + 48 }]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push('/settings');
              }}
            >
              <Ionicons name="settings-outline" size={18} color="#1B2230" />
              <Text style={styles.menuText}>Configurações</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={async () => {
                setMenuOpen(false);
                await logout();
                router.replace('/login');
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#1B2230" />
              <Text style={styles.menuText}>Sair ({user.username})</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={[styles.controls, { bottom: controlsBottom }]}>
        <View style={styles.side}>
          {latest && thumbUri && (
            <Pressable
              onPress={() => router.push({ pathname: '/result/[id]', params: { id: String(latest.id) } })}
              accessibilityLabel={`Último escaneado: ${latest.name}`}
            >
              <Image source={{ uri: thumbUri }} style={styles.thumb} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={scan}
          disabled={busy || !cameraReady}
          style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Escanear item"
        >
          {busy ? <ActivityIndicator color="#1B2230" /> : <Ionicons name="search" size={30} color="#1B2230" />}
        </Pressable>
        <View style={styles.side} />
      </View>

      {detected && !busy && focused && (
        <Pressable
          onPress={lookupDetected}
          style={({ pressed }) => [styles.codeChip, { bottom: controlsBottom + 92 }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`Buscar ${describeCode(detected).label}`}
        >
          <Ionicons name={describeCode(detected).icon} size={22} color="#1B2230" />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.codeLabel}>{describeCode(detected).label} detectado</Text>
            <Text style={styles.codeText} numberOfLines={1}>
              {describeCode(detected).text}
            </Text>
          </View>
          <View style={styles.codeAction}>
            <Text style={styles.codeActionText}>Buscar</Text>
          </View>
        </Pressable>
      )}

      {busy && (
        <View style={[styles.busyPill, { bottom: controlsBottom + 96 }]}>
          <Text style={styles.busyText}>Analisando o item...</Text>
        </View>
      )}

      <BottomBar active="scan" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', left: 24, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  menu: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 190,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  menuText: { color: '#1B2230', fontSize: 15 },
  controls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { width: 72, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#fff', backgroundColor: '#333' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  codeChip: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  codeLabel: { color: '#5D6B80', fontSize: 11 },
  codeText: { color: '#1B2230', fontSize: 14, fontWeight: '600' },
  codeAction: { backgroundColor: '#2F5FB3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  codeActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  busyPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  busyText: { color: '#fff', fontSize: 14 },
});
