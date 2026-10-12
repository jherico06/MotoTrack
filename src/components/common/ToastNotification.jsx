import React from 'react';
import { View, Text } from 'react-native';
import BootstrapIcon from './BootstrapIcon.jsx';
import { shopStyles as styles } from '../../styles/shop.styles.js';

export default function ToastNotification({ message }) {
  if (!message) return null;

  return (
    <View style={styles.toastContainer}>
      <BootstrapIcon name="stars" size={14} color="#f59e0b" />
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}
