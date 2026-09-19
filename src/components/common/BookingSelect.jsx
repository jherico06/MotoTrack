import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import BootstrapIcon from './BootstrapIcon';

const SELECT_STYLE = {
  width: '100%',
  backgroundColor: '#F8FAFC',
  border: '1.5px solid #E2E8F0',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  color: '#0F172A',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
};

export default function BookingSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option',
  emptyText = 'No options available',
  accentColor = '#0C6258',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((opt) => String(opt.value) === String(value));

  if (!options.length) {
    return (
      <View style={{ marginBottom: 12 }}>
        {label ? (
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
            {label}
          </Text>
        ) : null}
        <Text style={{ fontSize: 12.5, color: '#64748B' }}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 12, zIndex: isOpen ? 20 : 1 }}>
      {label ? (
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      {Platform.OS === 'web' ? (
        <select
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          style={SELECT_STYLE}
        >
          {!selected ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setIsOpen((open) => !open)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC',
              borderWidth: 1.5,
              borderColor: isOpen ? accentColor : '#E2E8F0',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 10,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '700',
                color: selected ? '#0F172A' : '#94A3B8',
              }}
              numberOfLines={1}
            >
              {selected?.label || placeholder}
            </Text>
            <BootstrapIcon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#64748B" />
          </TouchableOpacity>

          {isOpen ? (
            <View
              style={{
                marginTop: 6,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderColor: '#E2E8F0',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} showsVerticalScrollIndicator>
                {options.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      onPress={() => {
                        onChange?.(opt.value);
                        setIsOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        backgroundColor: active ? '#F0FDFA' : '#FFFFFF',
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: active ? '800' : '600',
                          color: active ? accentColor : '#0F172A',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
