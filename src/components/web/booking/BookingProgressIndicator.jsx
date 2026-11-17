// =========================================================================
// MotoTrack Minimalist Horizontal Booking Progress Indicator
// Steps: 1. Choose Service | 2. Motorcycle | 3. Schedule | 4. Review
// =========================================================================

import React from 'react';
import { useTheme } from '../../../context/ThemeContext.jsx';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { BootstrapIcon } from '../../common';

export const BOOKING_STEPS = [
  { id: 1, label: 'Choose Service', icon: 'wrench-adjustable' },
  { id: 2, label: 'Rider Info', icon: 'person-lines-fill' },
  { id: 3, label: 'Schedule', icon: 'calendar3' },
  { id: 4, label: 'Review', icon: 'check2-circle' },
  { id: 5, label: 'Payment', icon: 'credit-card-2-front' },
];

export default function BookingProgressIndicator({
  currentStep = 1,
  onStepClick,
  canNavigateToStep,
}) {
  const { isDarkMode } = useTheme();
  const progressStyles = get_progressStyles(isDarkMode);
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 540;
  const isTiny = windowWidth < 380;

  return (
    <View style={[progressStyles.wrapper, isNarrow && { paddingHorizontal: isTiny ? 10 : 12, paddingVertical: 14 }]}>
      <View style={[progressStyles.container, isNarrow && { paddingHorizontal: isTiny ? 10 : 12, paddingVertical: 10 }]}>
        {BOOKING_STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const canClick = canNavigateToStep ? canNavigateToStep(step.id) : isCompleted;
          const showLabel = !isNarrow || isActive;

          return (
            <React.Fragment key={step.id}>
              <TouchableOpacity
                style={[
                  progressStyles.stepNode,
                  canClick && progressStyles.stepNodeClickable,
                  isNarrow && { gap: 6, paddingHorizontal: 4 },
                ]}
                disabled={!canClick}
                onPress={() => onStepClick && onStepClick(step.id)}
                activeOpacity={0.8}
              >
                {/* Circle Badge */}
                <View
                  style={[
                    progressStyles.stepCircle,
                    isActive && progressStyles.stepCircleActive,
                    isCompleted && progressStyles.stepCircleCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <BootstrapIcon name="check" size={13} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        progressStyles.stepNumber,
                        isActive && progressStyles.stepNumberActive,
                      ]}
                    >
                      {step.id}
                    </Text>
                  )}
                </View>

                {/* Step Label (Hidden on small screens for non-active steps to prevent overflowing) */}
                {showLabel && (
                  <Text
                    style={[
                      progressStyles.stepLabel,
                      isActive && progressStyles.stepLabelActive,
                      isCompleted && progressStyles.stepLabelCompleted,
                      isNarrow && { fontSize: 11.5 },
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Connecting Divider Line */}
              {idx < BOOKING_STEPS.length - 1 && (
                <View
                  style={[
                    progressStyles.connector,
                    isCompleted && progressStyles.connectorCompleted,
                    isNarrow && { marginHorizontal: 4 },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

let _light_progressStyles = null;
let _dark_progressStyles = null;
function get_progressStyles(isDarkMode) {
  if (isDarkMode && _dark_progressStyles) return _dark_progressStyles;
  if (!isDarkMode && _light_progressStyles) return _light_progressStyles;
  const created = StyleSheet.create({

  wrapper: {
    maxWidth: 820,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  container: {
    backgroundColor: isDarkMode ? '#191A1D' : '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? '#303236' : '#E4E4E7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  stepNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  stepNodeClickable: {
    cursor: 'pointer',
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? '#303236' : '#E4E4E7',
  },
  stepCircleActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  stepCircleCompleted: {
    backgroundColor: '#1E2227',
    borderColor: '#1E2227',
  },
  stepNumber: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#71717A',
    fontVariant: ['tabular-nums'],
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#71717A',
  },
  stepLabelActive: {
    fontWeight: '700',
    color: isDarkMode ? '#F2F2F3' : '#18181B',
  },
  stepLabelCompleted: {
    color: '#27272A',
    fontWeight: '600',
  },
  connector: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4E4E7',
    marginHorizontal: 8,
  },
  connectorCompleted: {
    backgroundColor: '#1E2227',
  },

  });
  if (isDarkMode) _dark_progressStyles = created;
  else _light_progressStyles = created;
  return created;
}

