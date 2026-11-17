import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MotoTrack App ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      const isWebDark =
        Platform.OS === 'web' &&
        typeof document !== 'undefined' &&
        document.documentElement?.classList?.contains('dark');

      return (
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: isWebDark ? '#111315' : '#0A2E28',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: isWebDark ? '#191A1D' : '#FFFFFF',
              borderRadius: 24,
              borderWidth: isWebDark ? 1 : 0,
              borderColor: isWebDark ? '#303236' : 'transparent',
              padding: 32,
              maxWidth: 500,
              width: '100%',
              alignItems: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 25,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: isWebDark ? 'rgba(240, 68, 68, 0.14)' : '#FEF2F2',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <BootstrapIcon name="exclamation-triangle-fill" size={30} color={isWebDark ? '#F04444' : '#DC2626'} />
            </View>

            <Text
              style={{
                fontSize: 22,
                fontWeight: '600',
                color: isWebDark ? '#F5F5F5' : '#0F172A',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              MotoTrack Experience Recovered
            </Text>

            <Text
              style={{
                fontSize: 13.5,
                color: isWebDark ? '#A1A1AA' : '#64748B',
                textAlign: 'center',
                lineHeight: 20,
                marginBottom: 20,
              }}
            >
              An unexpected display issue occurred. Click reload below to refresh your session.
            </Text>

            {this.state.error && (
              <ScrollView
                style={{
                  maxHeight: 120,
                  width: '100%',
                  backgroundColor: isWebDark ? '#202124' : '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: isWebDark ? '#303236' : '#E2E8F0',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    color: isWebDark ? '#F87171' : '#DC2626',
                  }}
                >
                  {this.state.error.toString()}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: isWebDark ? '#FF5A00' : '#EA580C',
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center',
              }}
              onPress={this.handleReload}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14.5 }}>
                Refresh & Continue Riding
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
