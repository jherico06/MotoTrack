import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';

function toDraftRows(sizes, basePrice = 0) {
  if (!Array.isArray(sizes)) return [];
  return sizes.map((raw) => {
    if (typeof raw === 'string') {
      return { label: raw, price: Number(basePrice) || 0, stock: '' };
    }
    return {
      label: String(raw?.label ?? raw?.size ?? ''),
      price: Number(raw?.price ?? basePrice) || 0,
      stock: raw?.stock === 0 || raw?.stock ? String(raw.stock) : '',
    };
  });
}

/**
 * Draft size rows. Syncs from props only when productKey changes (modal open / product switch).
 */
export default function ProductSizesEditor({
  sizes = [],
  basePrice = 0,
  onChange,
  formInputStyle,
  formLabelStyle,
  productKey = 'new',
}) {
  const [rows, setRows] = useState(() => toDraftRows(sizes, basePrice));
  const syncedKey = useRef(null);
  const basePriceRef = useRef(basePrice);
  basePriceRef.current = basePrice;

  useEffect(() => {
    if (syncedKey.current === productKey) return;
    syncedKey.current = productKey;
    setRows(toDraftRows(sizes, basePriceRef.current));
  }, [productKey, sizes]);

  const emit = (next) => {
    setRows(next);
    onChange?.(
      next.map((row) => ({
        label: String(row.label || ''),
        price: Number(row.price) || 0,
        ...(String(row.stock ?? '').trim() !== ''
          ? { stock: parseInt(String(row.stock), 10) || 0 }
          : {}),
      }))
    );
  };

  const updateRow = (index, patch) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      onChange?.(
        next.map((row) => ({
          label: String(row.label || ''),
          price: Number(row.price) || 0,
          ...(String(row.stock ?? '').trim() !== ''
            ? { stock: parseInt(String(row.stock), 10) || 0 }
            : {}),
        }))
      );
      return next;
    });
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onChange?.(
        next.map((row) => ({
          label: String(row.label || ''),
          price: Number(row.price) || 0,
          ...(String(row.stock ?? '').trim() !== ''
            ? { stock: parseInt(String(row.stock), 10) || 0 }
            : {}),
        }))
      );
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [
        ...prev,
        {
          label: '',
          price: Number(basePriceRef.current) || 0,
          stock: '',
        },
      ];
      onChange?.(
        next.map((row) => ({
          label: String(row.label || ''),
          price: Number(row.price) || 0,
          ...(String(row.stock ?? '').trim() !== ''
            ? { stock: parseInt(String(row.stock), 10) || 0 }
            : {}),
        }))
      );
      return next;
    });
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={formLabelStyle}>Sizes, Prices & Stock</Text>
      <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
        Add each size with its price. Set stock to 0 to mark Sold Out. Leave stock blank to use
        product stock. Every size needs a name before saving.
      </Text>

      {rows.map((row, index) => (
        <View
          key={`size-row-${index}`}
          style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}
        >
          <View style={{ flex: 1.3 }}>
            {index === 0 ? (
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Size</Text>
            ) : null}
            <TextInput
              style={formInputStyle}
              value={row.label}
              onChangeText={(val) => updateRow(index, { label: val })}
              placeholder="e.g. 120/70ZR17"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={{ flex: 0.9 }}>
            {index === 0 ? (
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Price</Text>
            ) : null}
            <TextInput
              style={formInputStyle}
              keyboardType="numeric"
              value={row.price === 0 || row.price ? String(row.price) : ''}
              onChangeText={(val) =>
                updateRow(index, { price: parseFloat(String(val).replace(/,/g, '')) || 0 })
              }
              placeholder={String(basePrice || '0')}
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={{ flex: 0.7 }}>
            {index === 0 ? (
              <Text style={[formLabelStyle, { fontSize: 11, marginBottom: 4 }]}>Stock</Text>
            ) : null}
            <TextInput
              style={formInputStyle}
              keyboardType="numeric"
              value={row.stock === 0 || row.stock ? String(row.stock) : ''}
              onChangeText={(val) => updateRow(index, { stock: val })}
              placeholder="—"
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
              marginTop: index === 0 ? 18 : 0,
            }}
            accessibilityLabel="Remove size"
          >
            <BootstrapIcon name="trash" size={14} color="#DC2626" />
          </TouchableOpacity>
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
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#1D4533' }}>Add Size</Text>
      </TouchableOpacity>
    </View>
  );
}
