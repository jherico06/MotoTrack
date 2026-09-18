import React from 'react';
import { Modal, View, StyleSheet, Platform } from 'react-native';
import DeliveryConfirmPage from '../../pages/DeliveryConfirmPage';

/**
 * In-app / in-web popup for the packing-label Confirm Delivery screen.
 * Same UI as the public confirm-delivery page — stays inside the current platform.
 */
export default function RiderConfirmDeliverySheet({ visible, token, onClose, onDone }) {
  return (
    <Modal
      visible={Boolean(visible && token)}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <DeliveryConfirmPage
          key={token || 'confirm'}
          token={token}
          onDone={() => {
            onDone?.();
            onClose?.();
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0C6258',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : null),
  },
});
