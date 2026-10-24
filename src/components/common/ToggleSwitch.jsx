import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';

export default function ToggleSwitch({
  value,
  onToggle,
  activeTrackColor = '#EA580C',
  inactiveTrackColor = '#CBD5E1',
  size = 'md',
  disabled = false,
  testID,
}) {
  const isSmall = size === 'sm';
  const width = isSmall ? 40 : 48;
  const height = isSmall ? 22 : 26;
  const thumbSize = isSmall ? 16 : 20;
  const borderRadius = height / 2;
  const thumbRadius = thumbSize / 2;

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={(e) => {
        e?.stopPropagation?.();
        if (!disabled) onToggle?.(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled }}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: value ? activeTrackColor : inactiveTrackColor,
        paddingHorizontal: 3,
        paddingVertical: 3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: value ? 'flex-end' : 'flex-start',
        opacity: disabled ? 0.6 : 1,
        ...(Platform.OS === 'web'
          ? {
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }
          : {}),
      }}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbRadius,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1.5 },
          shadowOpacity: 0.25,
          shadowRadius: 2.5,
          elevation: 3,
        }}
      />
    </TouchableOpacity>
  );
}
