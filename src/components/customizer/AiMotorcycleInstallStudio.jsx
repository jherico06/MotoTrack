import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { BootstrapIcon } from '../common';
import { pickImageFromFile } from '../../utils/imagePickerHelper';
import {
  getCustomizeApiBaseUrl,
  requestMotorcycleCustomization,
} from '../../services/aiCustomizeApi';

const TEAL = '#1D4533';

/**
 * End-to-end AI Motorcycle Customizer UI:
 * upload bike photo + part photo → Express /api/customize → Gemini/Imagen preview.
 */
export default function AiMotorcycleInstallStudio({ onRequireLogin, currentUser }) {
  const [bikeUri, setBikeUri] = useState(null);
  const [partUri, setPartUri] = useState(null);
  const [customRequest, setCustomRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resultUri, setResultUri] = useState(null);
  const [promptUsed, setPromptUsed] = useState('');
  const [modelUsed, setModelUsed] = useState('');

  const pickBike = async () => {
    setError('');
    const res = await pickImageFromFile();
    if (res?.success && res.uri) {
      setBikeUri(res.uri);
      setResultUri(null);
    } else if (res?.error && !/cancel/i.test(res.error)) {
      setError(res.error);
    }
  };

  const pickPart = async () => {
    setError('');
    const res = await pickImageFromFile();
    if (res?.success && res.uri) {
      setPartUri(res.uri);
      setResultUri(null);
    } else if (res?.error && !/cancel/i.test(res.error)) {
      setError(res.error);
    }
  };

  const handleGenerate = async () => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    if (!bikeUri || !partUri) {
      setError('Upload both the motorcycle photo and the part photo.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('Uploading images and generating with Gemini / Imagen…');
    setResultUri(null);

    const result = await requestMotorcycleCustomization({
      bikeUri,
      partUri,
      customRequest,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Generation failed.');
      setInfo('');
      return;
    }

    setResultUri(result.previewImageUrl);
    setPromptUsed(result.promptUsed || '');
    setModelUsed(result.model || '');
    setInfo(
      result.note
        ? `Done (${result.model}). ${result.note}`
        : `Done — part installed on your motorcycle (${result.model}).`
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>AI INSTALL STUDIO</Text>
      <Text style={styles.sub}>
        Upload your motorcycle and the accessory photo. The server analyzes both with Gemini 2.5 Flash,
        then generates a photorealistic install render.
      </Text>
      <Text style={styles.apiHint}>API: {getCustomizeApiBaseUrl()}</Text>

      {(error || info) && (
        <View style={[styles.banner, error ? styles.bannerError : styles.bannerInfo]}>
          <Text style={styles.bannerText}>{error || info}</Text>
        </View>
      )}

      <View style={styles.uploadRow}>
        <UploadCard
          label="1. Motorcycle"
          hint="Registered bike photo"
          uri={bikeUri}
          onPress={pickBike}
          disabled={loading}
        />
        <UploadCard
          label="2. Part"
          hint="Accessory to install"
          uri={partUri}
          onPress={pickPart}
          disabled={loading}
        />
      </View>

      <Text style={styles.label}>Custom notes (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Install this rim on the rear wheel, keep stock color"
        placeholderTextColor="#94A3B8"
        value={customRequest}
        onChangeText={setCustomRequest}
        editable={!loading}
        multiline
      />

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitDisabled]}
        onPress={handleGenerate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.submitText}>Generating…</Text>
          </>
        ) : (
          <>
            <BootstrapIcon name="magic" size={16} color="#FFFFFF" />
            <Text style={styles.submitText}>Install part & generate</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>Customized render</Text>
        {resultUri ? (
          <Image source={{ uri: resultUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.previewEmpty}>
            <BootstrapIcon name="image" size={28} color="#94A3B8" />
            <Text style={styles.previewEmptyText}>
              Result appears here after generation
            </Text>
          </View>
        )}
        {!!modelUsed && <Text style={styles.meta}>Model: {modelUsed}</Text>}
        {!!promptUsed && (
          <Text style={styles.prompt} numberOfLines={4}>
            Prompt: {promptUsed}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function UploadCard({ label, hint, uri, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbEmpty}>
          <BootstrapIcon name="cloud-upload" size={22} color={TEAL} />
          <Text style={styles.thumbHint}>{hint}</Text>
        </View>
      )}
      <Text style={styles.cardAction}>{uri ? 'Change photo' : 'Upload photo'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  apiHint: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  banner: { padding: 12, borderRadius: 10 },
  bannerError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  bannerInfo: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  bannerText: { color: '#134E4A', fontSize: 12.5, fontWeight: '600' },
  uploadRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  cardLabel: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  thumb: { width: '100%', height: 120, borderRadius: 10, backgroundColor: '#E2E8F0' },
  thumbEmpty: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  thumbHint: { fontSize: 11, color: '#0F766E', textAlign: 'center' },
  cardAction: { marginTop: 8, fontSize: 12, fontWeight: '700', color: TEAL },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 10,
    minHeight: 72,
    textAlignVertical: 'top',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  submitBtn: {
    marginTop: 6,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitDisabled: { opacity: 0.75 },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  previewBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FAFBFC',
  },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  previewEmpty: {
    height: 180,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewEmptyText: { color: '#94A3B8', fontSize: 12 },
  meta: { marginTop: 8, fontSize: 11, color: '#64748B' },
  prompt: { marginTop: 4, fontSize: 11, color: '#94A3B8', lineHeight: 15 },
});
