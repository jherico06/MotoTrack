import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import BootstrapIcon from '../common/BootstrapIcon.jsx';

/**
 * MotoTrack Confirmation & Alert Dialog Modal
 * Matches the MotoTrack Atelier & Admin Design System:
 * - Signature Charcoal (#1E2227) / Brand Orange (#EA580C) / Danger (#DC2626)
 * - Refined typography (Inter), clean pill badges, and minimalist borders
 */
export default function ConfirmModal({
  visible = false,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  itemName,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmLabel,
  cancelLabel,
  danger,
  type = 'info', // 'danger' | 'warning' | 'info' | 'success'
  confirmIcon,
  onConfirm,
  onCancel,
  isLoading = false,
  hideCancel = false,
  isDark: isDarkProp,
}) {
  if (!visible) return null;

  const isDark = isDarkProp ?? (typeof document !== 'undefined' && document.documentElement?.classList.contains('dark'));

  const actualType = danger ? 'danger' : type;
  const isDanger = actualType === 'danger';
  const isWarning = actualType === 'warning';
  const isSuccess = actualType === 'success';

  const resolvedConfirmText = confirmLabel || confirmText;
  const resolvedCancelText = cancelLabel || cancelText;

  // Icon badge colors and icons matching MotoTrack Brand System
  const iconName =
    confirmIcon ||
    (isDanger
      ? 'trash3-fill'
      : isWarning
        ? 'exclamation-triangle-fill'
        : 'check-circle-fill');

  const badgeBg = isDanger
    ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2')
    : isWarning
      ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB')
      : (isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED');

  const badgeBorder = isDanger
    ? (isDark ? 'rgba(239, 68, 68, 0.35)' : '#FEE2E2')
    : isWarning
      ? (isDark ? 'rgba(245, 158, 11, 0.35)' : '#FEF3C7')
      : (isDark ? 'rgba(234, 88, 12, 0.35)' : '#FED7AA');

  const iconColor = isDanger
    ? (isDark ? '#F87171' : '#DC2626')
    : isWarning
      ? (isDark ? '#FBBF24' : '#D97706')
      : (isDark ? '#FB923C' : '#EA580C');

  // Primary action button background
  // Danger -> Red (#DC2626)
  // Warning -> Brand Orange (#EA580C)
  // Success / Standard -> MotoTrack Signature Atelier Charcoal (#1E2227)
  const confirmBg = isDanger
    ? '#DC2626'
    : isWarning
      ? '#EA580C'
      : (isDark ? '#27272A' : '#1E2227');

  const confirmBorder = isDanger
    ? '#DC2626'
    : isWarning
      ? '#EA580C'
      : (isDark ? '#3F3F46' : '#1E2227');

  const cleanItemName = itemName ? String(itemName).replace(/^"+|"+$/g, '').trim() : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Backdrop Click Area */}
        <TouchableOpacity
          style={styles.backdropClickArea}
          activeOpacity={1}
          onPress={hideCancel ? onConfirm : onCancel}
        />

        <View style={[styles.cardContainer, isDark && styles.cardContainerDark]}>
          <View style={styles.cardContent}>
            {/* Centered Brand Icon Badge */}
            <View style={[styles.iconBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <BootstrapIcon name={iconName} size={22} color={iconColor} />
            </View>

            {/* Title */}
            <Text style={[styles.titleText, isDark && styles.textLight]}>{title}</Text>

            {/* Message Body */}
            <Text style={[styles.messageText, isDark && styles.textMuted]}>{message}</Text>

            {/* Highlighted Item Badge (Clean Monospace Reference Pill) */}
            {cleanItemName ? (
              <View style={[styles.itemHighlightBox, isDark && styles.itemHighlightBoxDark]}>
                <BootstrapIcon
                  name={isDanger ? 'trash3' : 'receipt'}
                  size={13}
                  color={isDanger ? (isDark ? '#F87171' : '#DC2626') : (isDark ? '#FB923C' : '#EA580C')}
                />
                <Text
                  style={[
                    styles.itemHighlightText,
                    isDark && styles.itemHighlightTextDark,
                    isDanger && { color: isDark ? '#FCA5A5' : '#991B1B' },
                  ]}
                  numberOfLines={2}
                >
                  {cleanItemName}
                </Text>
              </View>
            ) : null}

            {/* Action Buttons Row */}
            <View style={styles.buttonsRow}>
              {!hideCancel && (
                <TouchableOpacity
                  style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                  disabled={isLoading}
                >
                  <Text style={[styles.cancelButtonText, isDark && styles.cancelButtonTextDark]}>
                    {resolvedCancelText}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: confirmBg, borderColor: confirmBorder },
                  hideCancel && { flex: 1 },
                ]}
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
                      size={13}
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(5px)' } : {}),
  },
  backdropClickArea: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 410 : 360,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 20,
  },
  cardContainerDark: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
  },
  cardContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleText: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.25,
    marginBottom: 6,
  },
  textLight: {
    color: '#F8FAFC',
  },
  messageText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  textMuted: {
    color: '#94A3B8',
  },
  itemHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    width: '100%',
    justifyContent: 'center',
  },
  itemHighlightBoxDark: {
    backgroundColor: '#202024',
    borderColor: '#2A2A2E',
  },
  itemHighlightText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'monospace, sans-serif' : undefined,
  },
  itemHighlightTextDark: {
    color: '#F1F5F9',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cancelButtonDark: {
    backgroundColor: '#202024',
    borderColor: '#2E2E32',
  },
  cancelButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButtonTextDark: {
    color: '#CBD5E1',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
  },
});
