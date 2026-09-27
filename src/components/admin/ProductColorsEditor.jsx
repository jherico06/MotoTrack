import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';
import { pickImageFromFile } from '../../utils/imagePickerHelper';
import { uploadProductImage } from '../../utils/productImageUpload';

function toDraftRows(colors) {
  if (!Array.isArray(colors)) return [];
  return colors.map((raw) => {
    if (typeof raw === 'string') {
      return { label: raw, hex: '#1D4533', image: '', stock: '' };
    }
    return {
      label: String(raw?.label ?? raw?.name ?? raw?.color ?? ''),
      hex: String(raw?.hex ?? '#1D4533'),
      image: String(raw?.image ?? ''),
      stock: raw?.stock === 0 || raw?.stock ? String(raw.stock) : '',
    };
  });
}

function rowsToPayload(next) {
  return next.map((row) => ({
    label: String(row.label || ''),
    hex: String(row.hex || ''),
    image: String(row.image || ''),
    ...(String(row.stock ?? '').trim() !== ''
      ? { stock: parseInt(String(row.stock), 10) || 0 }
      : {}),
  }));
}

/**
 * Draft color rows. Syncs from props only when productKey changes.
 * Photos upload to Supabase Storage when possible (URL stored, not huge base64).
 */
export default function ProductColorsEditor({
  colors = [],
  onChange,
  formInputStyle,
  formLabelStyle,
  onToast,
  productKey = 'new',
}) {
  const [rows, setRows] = useState(() => toDraftRows(colors));
  const [pickingIndex, setPickingIndex] = useState(null);
  const syncedKey = useRef(null);

  useEffect(() => {
    if (syncedKey.current === productKey) return;
    syncedKey.current = productKey;
    setRows(toDraftRows(colors));
  }, [productKey, colors]);

  const updateRow = (index, patch) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      onChange?.(rowsToPayload(next));
      return next;
    });
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onChange?.(rowsToPayload(next));
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [
        ...prev,
        {
          label: '',
          hex: '#1D4533',
          image: '',
          stock: '',
        },
      ];
      onChange?.(rowsToPayload(next));
      return next;
    });
  };

  const pickColorPhoto = async (index) => {
    setPickingIndex(index);
    try {
      const res = await pickImageFromFile();
      if (!res.success || !res.uri) {
        if (res.error && res.error !== 'Selection cancelled' && res.error !== 'No file selected') {
          onToast?.(res.error);
        }
        return;
      }

      onToast?.('Uploading color photo…');
      const uploaded = await uploadProductImage(res.uri, {
        folder: 'colors',
        fileName: `colors/${productKey}-${index}-${Date.now()}.jpg`,
      });
      const finalUri = uploaded.success && uploaded.url ? uploaded.url : res.uri;

      setRows((prev) => {
        const next = prev.map((row, i) => (i === index ? { ...row, image: finalUri } : row));
        onChange?.(rowsToPayload(next));
        return next;
      });

      if (uploaded.success && !uploaded.skipped) {
        onToast?.('Color photo uploaded');
      } else if (!uploaded.success) {
        onToast?.(
          uploaded.error
            ? `Photo kept locally (upload failed: ${uploaded.error})`
            : 'Color photo selected (local preview)'
        );
      } else {
        onToast?.('Color photo selected');
      }
    } finally {
      setPickingIndex(null);
    }
  };

  const isDark = typeof document !== 'undefined' && document.documentElement?.classList.contains('dark');

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={formLabelStyle}>Colors & Preview Images</Text>
      <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8 }}>
        Add each color with a name, then upload a photo for that finish. Customers see the matching
        photo when they pick the color. Color names are required when a photo is set.
      </Text>

      {rows.map((row, index) => (
        <View
          key={`color-row-${index}`}
          style={{
            marginBottom: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            backgroundColor: isDark ? '#1C2422' : '#F8FAFC',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: row.hex || '#CBD5E1',
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Color name *</Text>
              <TextInput
                style={formInputStyle}
                value={row.label}
                onChangeText={(val) => updateRow(index, { label: val })}
                placeholder="e.g. Matte Black"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <TouchableOpacity
              onPress={() => removeRow(index)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: '#FEF2F2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Remove color"
            >
              <BootstrapIcon name="trash" size={14} color="#DC2626" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 0.7 }}>
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Hex</Text>
              <TextInput
                style={formInputStyle}
                value={row.hex || ''}
                onChangeText={(val) => updateRow(index, { hex: val })}
                placeholder="#111111"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
            <View style={{ flex: 0.7 }}>
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Stock</Text>
              <TextInput
                style={formInputStyle}
                keyboardType="numeric"
                value={row.stock === 0 || row.stock ? String(row.stock) : ''}
                onChangeText={(val) => updateRow(index, { stock: val })}
                placeholder="—"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View>
            <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 6 }]}>Color photo</Text>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                padding: 10,
                backgroundColor: isDark ? '#141A18' : '#FFFFFF',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              }}
            >
              {row.image ? (
                <Image
                  source={{ uri: row.image }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 10,
                    backgroundColor: isDark ? '#1C2422' : '#E2E8F0',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1',
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 10,
                    backgroundColor: isDark ? '#1C2422' : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                  }}
                >
                  <BootstrapIcon name="image" size={22} color="#94A3B8" />
                </View>
              )}

              <View style={{ flex: 1, gap: 6 }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: '#1D4533',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    opacity: pickingIndex === index ? 0.7 : 1,
                  }}
                  onPress={() => pickColorPhoto(index)}
                  disabled={pickingIndex === index}
                  activeOpacity={0.85}
                >
                  {pickingIndex === index ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <BootstrapIcon name="folder2-open" size={14} color="#FFFFFF" />
                  )}
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                    {row.image ? 'Change Photo' : 'Choose Photo from File'}
                  </Text>
                </TouchableOpacity>

                {row.image ? (
                  <TouchableOpacity
                    onPress={() => updateRow(index, { image: '' })}
                    style={{ alignSelf: 'flex-start', paddingVertical: 2 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                      Remove photo
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Upload PNG / JPG of this color finish
                  </Text>
                )}
              </View>
            </View>

            <Text
              style={[
                formLabelStyle,
                { fontSize: 11, marginTop: 8, marginBottom: 4, color: '#64748B' },
              ]}
            >
              Or paste image URL
            </Text>
            <TextInput
              style={formInputStyle}
              value={row.image && String(row.image).startsWith('data:') ? '' : row.image || ''}
              onChangeText={(val) => updateRow(index, { image: val })}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={addRow}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: '#1D4533',
          backgroundColor: '#F0FDFA',
          marginTop: 2,
        }}
        activeOpacity={0.85}
      >
        <BootstrapIcon name="plus-lg" size={12} color="#1D4533" />
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>Add Color</Text>
      </TouchableOpacity>
    </View>
  );
}
