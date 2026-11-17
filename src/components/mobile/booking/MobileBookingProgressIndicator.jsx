import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { BootstrapIcon } from '../../common';

export const MOBILE_BOOKING_STEPS = [
  { id: 1, label: 'Choose Service', icon: 'wrench-adjustable' },
  { id: 2, label: 'Rider Info', icon: 'person-lines-fill' },
  { id: 3, label: 'Schedule', icon: 'calendar3' },
  { id: 4, label: 'Review', icon: 'check2-circle' },
  { id: 5, label: 'Payment', icon: 'credit-card-2-front' },
];

export default function MobileBookingProgressIndicator({
  currentStep = 1,
  isDarkMode = false,
  onStepClick,
  canNavigateToStep,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 540;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          isDarkMode && styles.containerDark,
          isNarrow && { paddingHorizontal: 10, paddingVertical: 10 },
        ]}
      >
        {MOBILE_BOOKING_STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const canClick = canNavigateToStep ? canNavigateToStep(step.id) : isCompleted;
          const showLabel = !isNarrow || isActive;

          return (
            <React.Fragment key={step.id}>
              <TouchableOpacity
                style={[styles.stepNode, isNarrow && { gap: 6, paddingHorizontal: 3 }]}
                disabled={!canClick}
                onPress={() => onStepClick && onStepClick(step.id)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.stepCircle,
                    isDarkMode && styles.stepCircleDark,
                    isActive && styles.stepCircleActive,
                    isCompleted && styles.stepCircleCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <BootstrapIcon name="check" size={13} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepNumber,
                        isDarkMode && { color: '#A1A1AA' },
                        isActive && styles.stepNumberActive,
                      ]}
                    >
                      {step.id}
                    </Text>
                  )}
                </View>

                {showLabel ? (
                  <Text
                    style={[
                      styles.stepLabel,
                      isDarkMode && { color: '#A1A1AA' },
                      isActive && (isDarkMode ? { color: '#F2F2F3', fontWeight: '700' } : styles.stepLabelActive),
                      isCompleted && (isDarkMode ? { color: '#F2F2F3' } : styles.stepLabelCompleted),
                      isNarrow && { fontSize: 11.5 },
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                ) : null}
              </TouchableOpacity>

              {idx < MOBILE_BOOKING_STEPS.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    isDarkMode && { backgroundColor: '#303236' },
                    isCompleted && styles.connectorCompleted,
                    isNarrow && { marginHorizontal: 4 },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  containerDark: {
    backgroundColor: '#191A1D',
    borderColor: '#303236',
  },
  stepNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  stepCircleDark: {
    backgroundColor: '#202124',
    borderColor: '#303236',
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
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  stepLabelActive: {
    fontWeight: '700',
    color: '#18181B',
  },
  stepLabelCompleted: {
    fontWeight: '600',
    color: '#18181B',
  },
  connector: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E4E4E7',
    marginHorizontal: 6,
  },
  connectorCompleted: {
    backgroundColor: '#EA580C',
  },
});
