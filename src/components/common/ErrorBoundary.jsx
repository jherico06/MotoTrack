import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';

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
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A2E28', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
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
                backgroundColor: '#FEF2F2',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 28 }}>⚠️</Text>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
              MotoTrack Experience Recovered
            </Text>

            <Text style={{ fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              An unexpected display issue occurred. Click reload below to refresh your session.
            </Text>

            {this.state.error && (
              <ScrollView
                style={{
                  maxHeight: 120,
                  width: '100%',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#DC2626' }}>
                  {this.state.error.toString()}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: '#0C6258',
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center',
              }}
              onPress={this.handleReload}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14.5 }}>
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
