/**
 * Admin Order Details & Fulfillment Control modal.
 * Guided workflow: status → next action → confirm → progress.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { BootstrapIcon, ExpectedDeliveryEditor } from '../common';
import {
  getStatusExplanation,
  getStatusTone,
  getStepStates,
  resolvePrimaryAction,
  buildOrderActivity,
  canCancelOrder,
  canonicalizeStatus,
  ORDER_STATUSES,
} from '../../utils/orderWorkflow.js';

function Section({ title, right, children, tokens, isDark, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: isDark ? tokens.bgSub || tokens.bgCard : '#FFFFFF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border,
          padding: 14,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: children ? 12 : 0,
          gap: 8,
        }}
      >
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '800',
            color: tokens.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.55,
          }}
        >
          {title}
        </Text>
        {right || null}
      </View>
      {children}
    </View>
  );
}

function WorkflowStepper({ status, tokens, isDark, isDesktop }) {
  const steps = useMemo(() => getStepStates(status), [status]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        minWidth: isDesktop ? '100%' : undefined,
      }}
    >
      {steps.map((step, idx) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const failed = step.state === 'failed';
        const color = failed
          ? '#DC2626'
          : done
            ? isDark
              ? '#4DB896'
              : '#059669'
            : current
              ? getStatusTone(step.status, isDark).color
              : tokens.textMuted;
        const bg = current
          ? getStatusTone(step.status, isDark).bg
          : done
            ? isDark
              ? 'rgba(16,185,129,0.12)'
              : '#ECFDF5'
            : isDark
              ? tokens.bgElevated || '#1E293B'
              : '#F8FAFC';
        return (
          <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', minWidth: isDesktop ? 88 : 78 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: bg,
                  borderWidth: 1.5,
                  borderColor: color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <BootstrapIcon name="check-lg" size={12} color={color} />
                ) : failed ? (
                  <BootstrapIcon name="x-lg" size={11} color={color} />
                ) : (
                  <View
                    style={{
                      width: current ? 10 : 6,
                      height: current ? 10 : 6,
                      borderRadius: 5,
                      backgroundColor: color,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: current ? '800' : '600',
                  color: current || done ? tokens.textPrimary : tokens.textMuted,
                  marginTop: 6,
                  textAlign: 'center',
                  maxWidth: 86,
                }}
                numberOfLines={2}
              >
                {step.shortLabel}
              </Text>
            </View>
            {idx < steps.length - 1 ? (
              <View
                style={{
                  width: isDesktop ? 18 : 12,
                  height: 2,
                  backgroundColor: done ? (isDark ? '#4DB896' : '#A7F3D0') : tokens.border,
                  marginBottom: 18,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * @param {object} props
 */
export default function AdminOrderDetailsModal({
  visible,
  order,
  deliveryDetail,
  deliveryHistory = [],
  isDarkMode = false,
  isDesktop = true,
  tokens,
  styles,
  onClose,
  onApprove,
  onAdvanceStatus,
  onReject,
  onCancel,
  onAssignRider,
  onOpenQr,
  onOpenRiderAccess,
  onDeliveryAction,
  onUploadProof,
  onViewProof,
  onProcessReturn,
  onPrint,
  showConfirm,
}) {
  const [busy, setBusy] = useState(false);

  const status = canonicalizeStatus(order?.status);
  const tone = useMemo(() => getStatusTone(status, isDarkMode), [status, isDarkMode]);
  const explanation = useMemo(() => getStatusExplanation(status), [status]);
  const primary = useMemo(
    () => resolvePrimaryAction(order, deliveryDetail),
    [order, deliveryDetail]
  );
  const activity = useMemo(
    () => buildOrderActivity(order, deliveryDetail, deliveryHistory),
    [order, deliveryDetail, deliveryHistory]
  );

  const orderId = order?.order_id || order?.id;
  const isTerminal =
    status === ORDER_STATUSES.DELIVERED ||
    status === ORDER_STATUSES.CANCELLED ||
    status === ORDER_STATUSES.REFUNDED;

  const runPrimary = async () => {
    if (!primary || primary.disabled || !orderId) return;

    const execute = async () => {
      setBusy(true);
      try {
        if (primary.kind === 'approve') {
          await onApprove?.(orderId);
        } else if (primary.kind === 'advance' && primary.nextStatus) {
          await onAdvanceStatus?.(orderId, primary.nextStatus);
        } else if (primary.kind === 'assign_rider') {
          onAssignRider?.(order);
        } else if (primary.kind === 'confirm_delivery') {
          onDeliveryAction?.({ mode: 'mark_delivered', order });
        } else if (primary.kind === 'log_rider_report') {
          onDeliveryAction?.({ mode: 'rider_report', order });
        } else if (primary.kind === 'return_approve') {
          await onProcessReturn?.(orderId, 'Approved');
        }
      } finally {
        setBusy(false);
      }
    };

    if (primary.needsConfirm && showConfirm) {
      showConfirm({
        title: primary.confirmTitle || 'Confirm action?',
        message: primary.confirmBody || 'Continue with this status change?',
        itemName: orderId ? `Order #${orderId}` : undefined,
        confirmText: primary.confirmText || primary.label || 'Confirm',
        cancelText: 'Cancel',
        type: primary.kind === 'approve' ? 'success' : 'warning',
        confirmIcon: 'check-circle-fill',
        onConfirm: execute,
      });
      return;
    }
    await execute();
  };

  if (!visible || !order || !tokens) return null;

  const itemsSubtotal =
    (order.items || []).reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
      0
    ) || Number(order.total_amount || 0);
  const shippingFee = Number(
    order.shipping_fee != null
      ? order.shipping_fee
      : deliveryDetail?.shipping_fee != null
        ? deliveryDetail.shipping_fee
        : 0
  );
  const grandTotal = Number(
    order.grand_total || itemsSubtotal + shippingFee - Number(order.discount_amount || 0)
  );

  const secondaryBtn = {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: isDarkMode ? tokens.bgElevated || tokens.bgCard : '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { width: '95%', maxWidth: 880, maxHeight: '94%' }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 180, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.modalTitle}>Order #{orderId}</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: tone.bg,
                    borderColor: tone.border,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                  }}
                >
                  <BootstrapIcon name={tone.icon} size={11} color={tone.color} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: tone.color }}>
                    {status}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2 }}>
                Placed on {order.order_date || formatLoose(order.created_at) || 'Recent'} •{' '}
                {order.channel || 'Online Store'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <BootstrapIcon name="x-lg" size={16} color={tokens.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
            {/* CURRENT STATUS + STEPPER */}
            <Section title="Order Status" tokens={tokens} isDark={isDarkMode}>
              <View
                style={{
                  backgroundColor: tone.bg,
                  borderWidth: 1,
                  borderColor: tone.border,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '800',
                    color: tone.color,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Current Status
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: tone.color, marginTop: 4 }}>
                  {status}
                </Text>
                <Text style={{ fontSize: 12.5, color: tokens.textPrimary, marginTop: 6, lineHeight: 18 }}>
                  {explanation}
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '800',
                  color: tokens.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Progress
              </Text>
              <WorkflowStepper
                status={status}
                tokens={tokens}
                isDark={isDarkMode}
                isDesktop={isDesktop}
              />
              {(status === ORDER_STATUSES.FAILED || status === ORDER_STATUSES.RESCHEDULED) && (
                <Text style={{ fontSize: 12, color: '#B45309', marginTop: 10, fontWeight: '600' }}>
                  Exception path active — use the next action below to continue fulfillment.
                </Text>
              )}
            </Section>

            {/* NEXT ACTION */}
            <Section title="Next Action" tokens={tokens} isDark={isDarkMode}>
              {primary?.infoBanner ? (
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(217,119,6,0.3)' : '#FDE68A',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 12.5, color: isDarkMode ? '#E0B35C' : '#92400E', lineHeight: 18 }}>
                    ⚠ {primary.infoBanner}
                  </Text>
                </View>
              ) : null}

              {primary?.hint ? (
                <Text style={{ fontSize: 13, color: tokens.textPrimary, marginBottom: 12, lineHeight: 19 }}>
                  {primary.hint}
                </Text>
              ) : null}

              {primary?.completeMessage ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BootstrapIcon name="check-circle-fill" size={16} color={isDarkMode ? '#4DB896' : '#059669'} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: tokens.textPrimary }}>
                    {primary.completeMessage}
                  </Text>
                </View>
              ) : null}

              {primary?.blockedReason && !primary.label ? (
                <View
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
                    borderRadius: 8,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(217,119,6,0.3)' : '#FDE68A',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: isDarkMode ? '#E0B35C' : '#92400E' }}>
                    Cannot proceed
                  </Text>
                  <Text style={{ fontSize: 12.5, color: tokens.textPrimary, marginTop: 4, lineHeight: 18 }}>
                    {primary.blockedReason}
                  </Text>
                </View>
              ) : null}

              {primary?.label ? (
                <TouchableOpacity
                  onPress={runPrimary}
                  disabled={busy || primary.disabled}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: primary.disabled
                      ? tokens.border
                      : isDarkMode
                        ? '#1F6B52'
                        : '#1D4533',
                    borderRadius: 10,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  <BootstrapIcon name="arrow-right-circle-fill" size={15} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                    {busy ? 'Working…' : primary.label}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {primary?.secondaryReturnReject ? (
                <TouchableOpacity
                  onPress={() => onProcessReturn?.(orderId, 'Rejected')}
                  style={[secondaryBtn, { marginTop: 8, alignSelf: 'flex-start' }]}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#B91C1C' }}>
                    Reject Return
                  </Text>
                </TouchableOpacity>
              ) : null}
            </Section>

            {/* ORDER INFORMATION */}
            <Section title="Order Information" tokens={tokens} isDark={isDarkMode}>
              <InfoGrid
                tokens={tokens}
                isDark={isDarkMode}
                rows={[
                  { label: 'Order ID', value: orderId },
                  { label: 'Order Date', value: order.order_date || formatLoose(order.created_at) || '—' },
                  { label: 'Sales Channel', value: order.channel || 'Online Store' },
                  { label: 'Payment Method', value: order.payment_method || '—' },
                  {
                    label: 'Payment Status',
                    value: status === ORDER_STATUSES.PENDING_APPROVAL ? 'Awaiting approval' : 'Verified / Accepted',
                  },
                ]}
              />
            </Section>

            {/* CUSTOMER */}
            <Section title="Customer Information" tokens={tokens} isDark={isDarkMode}>
              <InfoRow icon="person-fill" label="Customer Name" value={order.customer_name || 'Walk-in Customer'} tokens={tokens} isDark={isDarkMode} />
              <InfoRow icon="telephone-fill" label="Contact" value={order.customer_phone || 'None provided'} tokens={tokens} isDark={isDarkMode} />
              <InfoRow
                icon="geo-alt-fill"
                label="Delivery Address"
                value={order.customer_address || 'No address provided (Store Pickup)'}
                tokens={tokens}
                isDark={isDarkMode}
              />
              {order.delivery_notes ? (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: isDarkMode ? '#141A18' : '#F1F5F9',
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.textMuted }}>
                    Delivery notes
                  </Text>
                  <Text style={{ fontSize: 12.5, color: tokens.textPrimary, fontStyle: 'italic', marginTop: 2 }}>
                    "{order.delivery_notes}"
                  </Text>
                </View>
              ) : null}
              {order.cod_change_for ? (
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#4DB896' : '#059669', marginTop: 8 }}>
                  COD change for: ₱{Number(order.cod_change_for).toLocaleString()}
                </Text>
              ) : null}
            </Section>

            {/* RIDER */}
            {!isTerminal || deliveryDetail?.rider_name || order.rider_name ? (
              <Section
                title="Assigned Rider / Courier"
                tokens={tokens}
                isDark={isDarkMode}
                right={
                  !isTerminal && status !== ORDER_STATUSES.CANCELLED ? (
                    <TouchableOpacity
                      onPress={() => onAssignRider?.(order)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? '#1F6B52' : '#1D4533',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <BootstrapIcon name="person-plus-fill" size={11} color="#FFF" />
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFF' }}>
                        {deliveryDetail?.rider_name || order.rider_name ? 'Change Rider' : 'Assign Rider'}
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              >
                {deliveryDetail?.rider_name || order.rider_name ? (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ECFDF5',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
                      padding: 12,
                      borderRadius: 10,
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: isDarkMode ? '#4DB896' : '#065F46' }}>
                      {deliveryDetail?.rider_name || order.rider_name}
                    </Text>
                    {(deliveryDetail?.rider_contact || order.rider_contact) && (
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#4DB896' : '#047857' }}>
                        Contact: {deliveryDetail?.rider_contact || order.rider_contact}
                      </Text>
                    )}
                    {(deliveryDetail?.vehicle_info || order.vehicle_info) && (
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#4DB896' : '#047857' }}>
                        Vehicle: {deliveryDetail?.vehicle_info || order.vehicle_info}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: tokens.textMuted }}>
                    No rider assigned yet.
                  </Text>
                )}
              </Section>
            ) : null}

            {/* DELIVERY INFO */}
            <Section
              title="Delivery Information"
              tokens={tokens}
              isDark={isDarkMode}
              right={
                !isTerminal ? (
                  <TouchableOpacity
                    onPress={() => onAssignRider?.(order)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <BootstrapIcon name="truck" size={12} color={isDarkMode ? tokens.accentBrand : '#1D4533'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? tokens.accentBrand : '#1D4533' }}>
                      Update
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            >
              {deliveryDetail ? (
                <View style={{ gap: 8 }}>
                  <ExpectedDeliveryEditor
                    currentIso={deliveryDetail.expected_delivery_at || order.expected_delivery_at}
                    endIso={deliveryDetail.expected_delivery_end_at || order.expected_delivery_end_at}
                    isDarkMode={isDarkMode}
                  />
                  <Text style={{ fontSize: 12.5, color: tokens.textSecondary || tokens.textPrimary }}>
                    Admin confirmation:{' '}
                    {deliveryDetail.admin_confirmed
                      ? `Confirmed${deliveryDetail.admin_confirmed_at ? ` · ${new Date(deliveryDetail.admin_confirmed_at).toLocaleString()}` : ''}`
                      : 'Waiting for admin confirmation'}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: tokens.textSecondary || tokens.textPrimary }}>
                    Rider report:{' '}
                    {deliveryDetail.rider_reported_delivered
                      ? `Reported${deliveryDetail.rider_reported_at ? ` · ${new Date(deliveryDetail.rider_reported_at).toLocaleString()}` : ''}`
                      : 'Not reported yet'}
                  </Text>
                  {(deliveryDetail.delivery_photo || deliveryDetail.proof_of_delivery) && (
                    <TouchableOpacity
                      onPress={() =>
                        onViewProof?.({
                          uri: deliveryDetail.delivery_photo || deliveryDetail.proof_of_delivery,
                          notes: deliveryDetail.rider_report_notes || '',
                          reportedAt: deliveryDetail.rider_reported_at || null,
                          riderName: deliveryDetail.rider_name || '',
                          orderId,
                        })
                      }
                    >
                      <Image
                        source={{
                          uri: deliveryDetail.delivery_photo || deliveryDetail.proof_of_delivery,
                        }}
                        style={{ width: 88, height: 88, borderRadius: 10, backgroundColor: '#E2E8F0' }}
                      />
                    </TouchableOpacity>
                  )}
                  {!isTerminal && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity style={secondaryBtn} onPress={onUploadProof}>
                        <BootstrapIcon name="camera" size={12} color={tokens.textPrimary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                          {(deliveryDetail.delivery_photo || deliveryDetail.proof_of_delivery)
                            ? 'Replace Photo'
                            : 'Upload Photo'}
                        </Text>
                      </TouchableOpacity>
                      {(status === ORDER_STATUSES.OUT || status === ORDER_STATUSES.REPORTED) && (
                        <TouchableOpacity
                          style={[secondaryBtn, { borderColor: '#FECACA' }]}
                          onPress={() => onDeliveryAction?.({ mode: 'delivery_issue', order })}
                        >
                          <BootstrapIcon name="exclamation-triangle" size={12} color="#B91C1C" />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#B91C1C' }}>
                            Delivery Issue
                          </Text>
                        </TouchableOpacity>
                      )}
                      {(deliveryDetail.rider_id || order.rider_id) && (
                        <TouchableOpacity
                          style={secondaryBtn}
                          onPress={() =>
                            onOpenRiderAccess?.({
                              rider: {
                                id: deliveryDetail.rider_id || order.rider_id,
                                name: deliveryDetail.rider_name || order.rider_name,
                                phone: deliveryDetail.rider_contact || order.rider_contact,
                              },
                              bundle: null,
                            })
                          }
                        >
                          <BootstrapIcon name="geo-alt" size={12} color={tokens.textPrimary} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.textPrimary }}>
                            Rider dashboard
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: tokens.textMuted }}>
                  No delivery assignment yet. Assign a rider when the order is ready for dispatch.
                </Text>
              )}
            </Section>

            {/* ITEMS + PAYMENT */}
            <Section title="Order Items" tokens={tokens} isDark={isDarkMode}>
              {(order.items || []).map((it, idx) => (
                <View
                  key={it.product_id || idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: idx < (order.items?.length || 1) - 1 ? 1 : 0,
                    borderBottomColor: tokens.border,
                  }}
                >
                  <Image
                    source={{
                      uri:
                        it.image ||
                        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=200&q=80',
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? tokens.bgSub : '#F1F5F9',
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>
                      {it.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                      Qty {it.quantity || 1} · ₱{Number(it.price || 0).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: tokens.textPrimary }}>
                    ₱
                    {(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              ))}
            </Section>

            <Section title="Payment Summary" tokens={tokens} isDark={isDarkMode}>
              <SummaryLine label="Subtotal" value={`₱${itemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tokens={tokens} />
              <SummaryLine
                label="Shipping Fee"
                value={
                  shippingFee > 0
                    ? `₱${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'Free Shipping'
                }
                tokens={tokens}
              />
              {Number(order.discount_amount) > 0 ? (
                <SummaryLine
                  label="Discount"
                  value={`-₱${Number(order.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  tokens={tokens}
                  valueColor={isDarkMode ? '#4DB896' : '#16A34A'}
                />
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: tokens.border,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '900', color: tokens.textPrimary }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: isDarkMode ? tokens.accentBrand : '#1D4533' }}>
                  ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </Section>

            {/* ACTIVITY */}
            <Section title="Order Activity" tokens={tokens} isDark={isDarkMode}>
              {activity.length === 0 ? (
                <Text style={{ fontSize: 13, color: tokens.textMuted }}>No activity recorded yet.</Text>
              ) : (
                activity.map((ev, idx) => (
                  <View
                    key={ev.id}
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      paddingVertical: 8,
                      borderBottomWidth: idx < activity.length - 1 ? 1 : 0,
                      borderBottomColor: tokens.border,
                    }}
                  >
                    <View style={{ paddingTop: 2 }}>
                      {ev.failed ? (
                        <BootstrapIcon name="x-circle-fill" size={14} color="#DC2626" />
                      ) : ev.done ? (
                        <BootstrapIcon name="check-circle-fill" size={14} color={isDarkMode ? '#4DB896' : '#059669'} />
                      ) : (
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            borderWidth: 2,
                            borderColor: tone.color,
                            backgroundColor: tone.bg,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: ev.current ? '800' : '700',
                          color: tokens.textPrimary,
                        }}
                      >
                        {ev.inProgress ? `${ev.title} — currently in progress` : ev.title}
                      </Text>
                      {ev.when ? (
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2 }}>
                          {ev.when}
                        </Text>
                      ) : null}
                      {ev.by ? (
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 1 }}>
                          By: {ev.by}
                        </Text>
                      ) : null}
                      {ev.notes ? (
                        <Text style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2, fontStyle: 'italic' }}>
                          {ev.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Section>

            {/* ADDITIONAL ACTIONS */}
            <Section title="Additional Actions" tokens={tokens} isDark={isDarkMode}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={secondaryBtn} onPress={() => onOpenQr?.(order)}>
                  <BootstrapIcon name="qr-code" size={13} color={tokens.textPrimary} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.textPrimary }}>
                    Delivery QR
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={secondaryBtn} onPress={onPrint}>
                  <BootstrapIcon name="printer" size={13} color={tokens.textPrimary} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: tokens.textPrimary }}>
                    Print / Receipt
                  </Text>
                </TouchableOpacity>
                {canCancelOrder(status) ? (
                  <TouchableOpacity
                    style={[
                      secondaryBtn,
                      {
                        borderColor: isDarkMode ? 'rgba(220,38,38,0.4)' : '#FECACA',
                        backgroundColor: isDarkMode ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
                        marginLeft: isDesktop ? 'auto' : 0,
                      },
                    ]}
                    onPress={() => onReject?.(orderId)}
                  >
                    <BootstrapIcon name="x-circle" size={13} color="#DC2626" />
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#DC2626' }}>
                      Cancel Order
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {status === ORDER_STATUSES.CANCELLED && order.cancel_reason ? (
                  <View style={{ width: '100%', marginTop: 4 }}>
                    <Text style={{ fontSize: 12.5, color: tokens.textMuted }}>
                      Cancellation reason: {order.cancel_reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Section>
          </ScrollView>

          {/* Sticky footer: primary only + close */}
          <View
            style={[
              styles.modalFooter,
              {
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={secondaryBtn}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary }}>Close</Text>
            </TouchableOpacity>

            {primary?.label ? (
              <TouchableOpacity
                onPress={runPrimary}
                disabled={busy || primary.disabled}
                activeOpacity={0.85}
                style={{
                  backgroundColor: isDarkMode ? '#1F6B52' : '#1D4533',
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                  borderRadius: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <BootstrapIcon name="arrow-right-circle-fill" size={14} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 }}>
                  {busy ? 'Working…' : primary.label}
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? 'rgba(16,185,129,0.12)' : '#ECFDF5',
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: isDarkMode ? '#4DB896' : '#047857' }}>
                  {isTerminal ? 'No further workflow actions' : 'See next action above'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoGrid({ rows, tokens, isDark }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ minWidth: 140, flex: 1 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase' }}>
            {r.label}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, marginTop: 3 }}>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ icon, label, value, tokens, isDark }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <BootstrapIcon name={icon} size={13} color={tokens.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.textPrimary, flex: 1, lineHeight: 18 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SummaryLine({ label, value, tokens, valueColor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
      <Text style={{ fontSize: 12.5, color: tokens.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: valueColor || tokens.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

function formatLoose(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
