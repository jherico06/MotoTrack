import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon';

/**
 * MotoTrack Custom Confirmation & Alert Dialog Modal
 * Pops in the center of the screen with the MotoTrack brand design system.
 */
export default function ConfirmModal({
  visible = false,
  title = 'Confirm Removal',
  message = 'Are you sure you want to proceed?',
  itemName,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  confirmLabel,
  cancelLabel,
  danger,
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  confirmIcon,
  onConfirm,
  onCancel,
  isLoading = false,
  hideCancel = false, // When used as an alert dialog with single OK button
}) {
  if (!visible) return null;

  const actualType = danger ? 'danger' : type;
  const isDanger = actualType === 'danger';
  const isWarning = actualType === 'warning';
  const isInfo = actualType === 'info';
  const isSuccess = actualType === 'success';

  const resolvedConfirmText = confirmLabel || confirmText;
  const resolvedCancelText = cancelLabel || cancelText;

  // Badge icon styling based on type
  const iconName =
    confirmIcon ||
    (isDanger
      ? 'trash3-fill'
      : isWarning
        ? 'exclamation-triangle-fill'
        : isSuccess
          ? 'check-circle-fill'
          : 'info-circle-fill');

  const badgeBg = isDanger ? '#FEF2F2' : isWarning ? '#FFFBEB' : isSuccess ? '#F0FDF4' : '#F0FDFA';

  const badgeBorder = isDanger ? '#FEE2E2' : isWarning ? '#FEF3C7' : isSuccess ? '#DCFCE7' : '#CCFBF1';

  const iconColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : isSuccess ? '#10B981' : '#0C6258';

  const confirmBg = isDanger ? '#DC2626' : isWarning ? '#D97706' : isSuccess ? '#059669' : '#0C6258';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        {/* Backdrop Touchable */}
        <TouchableOpacity
          style={styles.backdropClickArea}
          activeOpacity={1}
          onPress={hideCancel ? onConfirm : onCancel}
        />

        <View style={styles.cardContainer}>
          {/* Top Brand Accent Stripe */}
          <View style={[styles.topAccentStripe, { backgroundColor: isDanger ? '#EF4444' : '#0C6258' }]} />

          <View style={styles.cardContent}>
            {/* Centered Glowing Icon Badge */}
            <View style={[styles.iconBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <BootstrapIcon name={iconName} size={28} color={iconColor} />
            </View>

            {/* Title */}
            <Text style={styles.titleText}>{title}</Text>

            {/* Message Body */}
            <Text style={styles.messageText}>{message}</Text>

            {/* Highlighted Item Badge (if provided) */}
            {itemName ? (
              <View style={styles.itemHighlightBox}>
                <BootstrapIcon name="box-seam" size={14} color={isDanger ? '#DC2626' : '#0C6258'} />
                <Text
                  style={[styles.itemHighlightText, { color: isDanger ? '#991B1B' : '#064E3B' }]}
                  numberOfLines={2}
                >
                  "{itemName}"
                </Text>
              </View>
            ) : null}

            {/* Action Buttons Row */}
            <View style={styles.buttonsRow}>
              {!hideCancel && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                  activeOpacity={0.8}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>{resolvedCancelText}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: confirmBg }, hideCancel && { flex: 1 }]}
                onPress={onConfirm}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.confirmBtnInner}>
                    <BootstrapIcon
                      name={confirmIcon || (isDanger ? 'trash3-fill' : 'check-lg')}
                      size={14}
                      color="#FFFFFF"
                    />
                    <Text style={styles.confirmButtonText}>{resolvedConfirmText}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
  },
  backdropClickArea: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    width: '100%',
    maxWidth: 440,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 25,
  },
  topAccentStripe: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    textAlign: 'center',
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 18.5,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  itemHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  itemHighlightText: {
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13.5,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
});
