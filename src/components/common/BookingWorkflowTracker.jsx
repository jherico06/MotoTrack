import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import BootstrapIcon from './BootstrapIcon';

/**
 * Minimalist Booking Workflow Stepper Component
 * 
 * Matches reference image stepper aesthetics:
 * Small circular indicators + thin connector lines + labels directly underneath.
 * Zero arrows, clean whitespace, 4 left-to-right rows connected by straight side lines.
 * 
 * Row 1:  ① Booking Submitted ─────── ② Admin Approved ─────── ③ Downpayment Paid
 *                                                                       │
 * Row 2:  ④ Scheduled ─────────────── ⑤ Inspection ─────────── ⑥ Quotation Approved
 *           │
 * Row 3:  ⑦ Service In Progress ───── ⑧ Service Completed ──── ⑨ Final Payment
 *                                                                       │
 * Row 4:  ⑩ Ready for Pickup ───────────────────────────────── ⑪ Completed
 */
export default function BookingWorkflowTracker({ progress = [] }) {
  if (!progress || progress.length === 0) return null;

  // Use progress steps directly (11 steps)
  const steps = progress;

  // Row step distribution (4 rows matching the 1..11 layout specification)
  // Row 0: steps 1, 2, 3 (indices 0, 1, 2)
  // Row 1: steps 4, 5, 6 (indices 3, 4, 5)
  // Row 2: steps 7, 8, 9 (indices 6, 7, 8)
  // Row 3: steps 10, 11 (indices 9, 10)
  const rowChunks = [
    [steps[0], steps[1], steps[2]].filter(Boolean),
    [steps[3], steps[4], steps[5]].filter(Boolean),
    [steps[6], steps[7], steps[8]].filter(Boolean),
    [steps[9], null, steps[10]].filter((x) => x !== undefined), // row 4 col 0 & col 2
  ];

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerTitleRow}>
        <View style={styles.headerLeft}>
          <BootstrapIcon name="diagram-3" size={15} color="#1D4533" />
          <Text style={styles.headerTitleText}>Service Workflow Tracker</Text>
        </View>
        <Text style={styles.headerSubtitleText}>Live Progress</Text>
      </View>

      <View style={styles.stepperContainer}>
        {/* ROW 1: Steps 1, 2, 3 */}
        <View style={styles.rowBlock}>
          <View style={styles.rowContent}>
            {/* Step 1 */}
            {renderStepNode(steps[0], 1)}
            {renderHorizontalLine(steps[0]?.done)}

            {/* Step 2 */}
            {renderStepNode(steps[1], 2)}
            {renderHorizontalLine(steps[1]?.done)}

            {/* Step 3 */}
            {renderStepNode(steps[2], 3)}
          </View>
        </View>

        {/* ROW 2: Steps 4, 5, 6 */}
        <View style={styles.rowBlock}>
          <View style={styles.rowContent}>
            {/* Step 4 */}
            {renderStepNode(steps[3], 4)}
            {renderHorizontalLine(steps[3]?.done)}

            {/* Step 5 */}
            {renderStepNode(steps[4], 5)}
            {renderHorizontalLine(steps[4]?.done)}

            {/* Step 6 */}
            {renderStepNode(steps[5], 6)}
          </View>
        </View>

        {/* ROW 3: Steps 7, 8, 9 */}
        <View style={styles.rowBlock}>
          <View style={styles.rowContent}>
            {/* Step 7 */}
            {renderStepNode(steps[6], 7)}
            {renderHorizontalLine(steps[6]?.done)}

            {/* Step 8 */}
            {renderStepNode(steps[7], 8)}
            {renderHorizontalLine(steps[7]?.done)}

            {/* Step 9 */}
            {renderStepNode(steps[8], 9)}
          </View>
        </View>

        {/* ROW 4: Steps 10, 11 */}
        <View style={styles.rowBlock}>
          <View style={styles.rowContent}>
            {/* Step 10 (Ready for Pickup) */}
            {renderStepNode(steps[9], 10)}

            {/* Long horizontal line spanning across Col 1 */}
            {renderLongHorizontalLine(steps[9]?.done)}

            {/* Step 11 (Completed) */}
            {renderStepNode(steps[10], 11)}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Render a single minimal step node (circle + label underneath) */
function renderStepNode(step, stepNumber) {
  if (!step) {
    return <View style={styles.nodeItemContainer} />;
  }

  const isDone = step.done;
  const isCurrent = step.current;

  return (
    <View style={styles.nodeItemContainer}>
      {/* Active Stage Badge (Positioned directly above circle) */}
      <View style={styles.badgeSpace}>
        {isCurrent && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>ACTIVE STAGE</Text>
          </View>
        )}
      </View>

      {/* Circle Indicator */}
      <View
        style={[
          styles.stepCircle,
          isDone && styles.stepCircleDone,
          isCurrent && styles.stepCircleCurrent,
        ]}
      >
        {isDone ? (
          <BootstrapIcon name="check-lg" size={13} color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.circleNumberText,
              (isDone || isCurrent) && styles.circleNumberTextActive,
            ]}
          >
            {stepNumber}
          </Text>
        )}
      </View>

      {/* Label Underneath */}
      <Text
        style={[
          styles.statusLabelText,
          isDone && styles.statusLabelTextDone,
          isCurrent && styles.statusLabelTextCurrent,
        ]}
        numberOfLines={2}
      >
        {step.label}
      </Text>
    </View>
  );
}

/** Render thin straight horizontal connector line */
function renderHorizontalLine(isCompleted) {
  return (
    <View style={styles.horizontalConnectorWrap}>
      <View
        style={[
          styles.horizontalLine,
          isCompleted && styles.lineCompleted,
        ]}
      />
    </View>
  );
}

/** Render spanning horizontal connector line for row 4 */
function renderLongHorizontalLine(isCompleted) {
  return (
    <View style={styles.longHorizontalConnectorWrap}>
      <View
        style={[
          styles.horizontalLine,
          isCompleted && styles.lineCompleted,
        ]}
      />
    </View>
  );
}

const CIRCLE_SIZE = 28;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
const BADGE_HEIGHT = 16;
const TOP_OFFSET = BADGE_HEIGHT + CIRCLE_RADIUS; // Center Y of circles = 16 + 14 = 30px

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  stepperContainer: {
    gap: 28, // Spacing between rows
  },
  rowBlock: {
    position: 'relative',
    width: '100%',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  nodeItemContainer: {
    alignItems: 'center',
    width: 90,
    zIndex: 2,
  },
  badgeSpace: {
    height: BADGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  activeBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.4,
  },
  stepCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_RADIUS,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#1D4533',
    borderColor: '#1D4533',
  },
  stepCircleCurrent: {
    backgroundColor: '#1D4533',
    borderColor: '#1D4533',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 0 3px #DCE9E2' }
      : { elevation: 2 }),
  },
  circleNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  circleNumberTextActive: {
    color: '#FFFFFF',
  },
  statusLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  statusLabelTextDone: {
    color: '#0F172A',
    fontWeight: '700',
  },
  statusLabelTextCurrent: {
    color: '#1D4533',
    fontWeight: '900',
  },
  horizontalConnectorWrap: {
    flex: 1,
    justifyContent: 'center',
    marginTop: TOP_OFFSET - 1, // Align with Y center of circles
    zIndex: 1,
  },
  longHorizontalConnectorWrap: {
    flex: 2,
    justifyContent: 'center',
    marginTop: TOP_OFFSET - 1,
    zIndex: 1,
  },
  horizontalLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  lineCompleted: {
    backgroundColor: '#1D4533',
  },
});
