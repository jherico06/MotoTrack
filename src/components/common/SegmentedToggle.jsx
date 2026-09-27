import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import BootstrapIcon from './BootstrapIcon';

/**
 * SegmentedToggle — Smooth sliding segmented control for MotoTrack
 *
 * Props:
 * - label: string (e.g. "Service Category")
 * - required: boolean
 * - value: string (currently selected option id)
 * - options: Array<{ id, label, icon, color, activeColor, badgeBg, activeBorder, glow }>
 * - onChange: (id) => void
 */
export default function SegmentedToggle({
  label,
  required = false,
  value,
  options = [],
  onChange,
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => String(opt.id) === String(value))
  );

  const selectedOption = options[selectedIndex] || options[0];
  const [trackWidth, setTrackWidth] = useState(0);

  // Animated value for native spring animation
  const slideAnim = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedIndex,
      tension: 75,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [selectedIndex]);

  const numOptions = Math.max(1, options.length);
  const gap = 6;
  const padding = 4;
  const pillWidth = trackWidth > 0 ? (trackWidth - padding * 2 - gap * (numOptions - 1)) / numOptions : 0;
  const step = pillWidth + gap;

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '700',
            color: '#334155',
            marginBottom: 8,
            letterSpacing: 0.2,
          }}
        >
          {label} {required && <Text style={{ color: '#DC2626' }}>*</Text>}
        </Text>
      )}

      {/* Outer Segmented Track */}
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          position: 'relative',
          flexDirection: 'row',
          backgroundColor: '#F1F5F9',
          borderRadius: 14,
          padding,
          borderWidth: 1.5,
          borderColor: '#E2E8F0',
          gap,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Sliding Indicator Pill */}
        {isWeb ? (
          <View
            style={{
              position: 'absolute',
              top: padding,
              bottom: padding,
              left: padding,
              width: `calc((100% - ${padding * 2 + gap * (numOptions - 1)}px) / ${numOptions})`,
              borderRadius: 10,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: selectedOption?.activeBorder || selectedOption?.color || '#1D4533',
              boxShadow: selectedOption?.glow
                ? `0 3px 12px ${selectedOption.glow}`
                : selectedOption?.id === 'Repair'
                ? '0 3px 12px rgba(220, 38, 38, 0.15)'
                : '0 3px 12px rgba(29, 69, 51, 0.15)',
              transform: `translateX(calc(${selectedIndex} * (100% + ${gap}px)))`,
              transition:
                'transform 0.3s cubic-bezier(0.34, 1.35, 0.64, 1), border-color 0.22s ease, box-shadow 0.22s ease',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        ) : (
          trackWidth > 0 && (
            <Animated.View
              style={{
                position: 'absolute',
                top: padding,
                bottom: padding,
                left: padding,
                width: pillWidth,
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderColor: selectedOption?.activeBorder || selectedOption?.color || '#1D4533',
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, step],
                    }),
                  },
                ],
                zIndex: 1,
              }}
            />
          )
        )}

        {/* Clickable Option Buttons */}
        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const isRepair = opt.id === 'Repair';
          const activeColor = opt.color || (isRepair ? '#DC2626' : '#1D4533');
          const activeLabelColor = opt.activeColor || (isRepair ? '#991B1B' : '#1D4533');
          const badgeBg = opt.badgeBg || (isRepair ? '#FEE2E2' : '#C8DDD3');

          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange?.(opt.id)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                zIndex: 2,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: isSelected ? badgeBg : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: isWeb ? 'all 0.22s ease' : undefined,
                }}
              >
                <BootstrapIcon
                  name={opt.icon || (isRepair ? 'wrench' : 'tools')}
                  size={13}
                  color={isSelected ? activeColor : '#64748B'}
                />
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: isSelected ? '800' : '600',
                  color: isSelected ? activeLabelColor : '#64748B',
                  transition: isWeb ? 'color 0.22s ease' : undefined,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
