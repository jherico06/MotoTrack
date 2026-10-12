import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';

/**
 * Desktop frame for staff tools whose working UI is a touch layout.
 * Narrow web windows keep the full-bleed mobile screen.
 */
export default function DesktopWorkArea({ title, subtitle, children, maxWidth = 1120 }) {
  const { width } = useWindowDimensions();
  if (width < 960) return children;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F4F7F5' }}>
      <View
        style={{
          width: 232,
          backgroundColor: '#1D4533',
          paddingTop: 28,
          paddingHorizontal: 22,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>MotoTrack</Text>
        <Text style={{ color: '#D1FAE5', marginTop: 8, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: '#A7C4B5', marginTop: 14, fontSize: 13, lineHeight: 19 }}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, maxWidth, backgroundColor: '#F8FAFC' }}>{children}</View>
    </View>
  );
}
