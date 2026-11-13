import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import BootstrapIcon from '../../common/BootstrapIcon.jsx';
import ServiceReceiptModal from '../../modals/ServiceReceiptModal.jsx';
import { normalizeBookingStatus } from '../../../utils/serviceQuotation.js';

function fmtShortDate(val) {
  if (!val) return 'Nov 9, 2026';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortTime(val) {
  if (!val) return '09:00 AM';
  const str = String(val).trim();
  const match = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
  return match ? match[1].toUpperCase() : str;
}

function formatPriceNumber(val) {
  const num = Number(val) || 0;
  return `₱${num.toLocaleString('en-US')}`;
}

export default function AtelierAppointmentCard({
  booking,
  viewMode = 'grid',
  onViewDetails,
  onReschedule,
  onCancel,
  canCancel = false,
  onToast,
  brandSettings,
  isDarkMode = false,
  isSelected = false,
  onSelect,
  className = '',
}) {
  const [receiptVisible, setReceiptVisible] = useState(false);

  const bookingId = booking?.booking_id || booking?.id || 'BK-PMS-2026-00002';
  const serviceTitle = booking?.service_title || booking?.package_name || 'Major Tune Up';
  
  // Short category badge (PMS, REPAIR, etc.)
  const rawCategory = String(booking?.service_type || booking?.category || 'PMS').toUpperCase();
  const shortCategory = rawCategory.includes('PREVENTIVE') || rawCategory.includes('PERIODIC') || rawCategory.includes('PMS')
    ? 'PMS'
    : rawCategory.includes('REPAIR')
    ? 'REPAIR'
    : rawCategory.includes('CUSTOM')
    ? 'CUSTOM'
    : 'PMS';

  // Bike & Plate
  const rawPlate = String(booking?.plate_number || booking?.plate || '').trim();
  const cleanPlate = rawPlate && !rawPlate.toLowerCase().startsWith('n/a') && !rawPlate.toLowerCase().includes('temp')
    ? rawPlate
    : rawPlate.replace(/^N\/A-?/i, '');
  const rawBike = booking?.motorcycle_model || booking?.motorcycle || booking?.bike_model || 'ADV 160';
  const bikeDisplay = rawBike.replace(/^Honda\s+/i, '').replace(/^Yamaha\s+/i, '').replace(/^Suzuki\s+/i, '').replace(/^Kawasaki\s+/i, '');

  // Financials
  const totalEstimate = Number(
    booking?.estimated_service_total ??
    booking?.estimatedServiceTotal ??
    booking?.total_amount ??
    booking?.pricePhp ??
    1300
  );
  const depositAmount = Number(
    booking?.downpayment_amount ??
    booking?.downpaymentAmount ??
    Math.round(totalEstimate * 0.3) ??
    390
  );
  const balanceAmount = Math.max(0, totalEstimate - depositAmount);
  const paymentMethod = booking?.payment_method || booking?.downpayment_channel || 'GCash';

  // Schedule
  const rawDate = booking?.preferred_date || booking?.appointment_date || booking?.date;
  const rawTime = booking?.preferred_time || booking?.time_slot;
  const formattedDate = fmtShortDate(rawDate);
  const formattedTime = fmtShortTime(rawTime);
  const bayName = booking?.bay_name || booking?.service_bay || 'Assigned to Pit Bay 02 (Express Bay)';

  // Shop Location
  const shopName = brandSettings?.shopName || "D'Blockchain Motorparts & Accessories";
  const shopAddress = brandSettings?.shopAddress || "Central Naga Highway, Naga City, Cebu";

  // Mechanic Assignment
  const hasAssignedMech = booking?.mechanic && !String(booking.mechanic).toLowerCase().includes('pending');
  const mechanicName = hasAssignedMech
    ? String(booking.mechanic).replace(/^Assigned to\s*/i, '')
    : 'Pending admin review & bay dispatch';
  const mechanicSub = hasAssignedMech
    ? 'Certified Master Technician assigned to bay'
    : 'Lead technician will be assigned 1 hour prior';

  // Submission Date
  const submittedDate = fmtShortDate(booking?.created_at || booking?.submitted_at || Date.now());

  // Status computation
  const normStatus = normalizeBookingStatus(booking?.status);

  const statusConfig = useMemo(() => {
    switch (normStatus) {
      case 'PENDING_REVIEW':
      case 'APPROVED':
      case 'SCHEDULED':
      case 'UNDER_INSPECTION':
      case 'AWAITING_DOWNPAYMENT':
      case 'QUOTATION_SENT':
      case 'AWAITING_CUSTOMER_APPROVAL':
        return {
          label: 'Pending Review',
          bg: isDarkMode ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]',
          dot: 'bg-[#F59E0B]',
        };
      case 'CONFIRMED':
      case 'SERVICE_IN_PROGRESS':
      case 'ADDITIONAL_APPROVAL_REQUIRED':
      case 'SERVICE_COMPLETED':
      case 'AWAITING_FINAL_PAYMENT':
        return {
          label: 'In Service',
          bg: isDarkMode ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]',
          dot: 'bg-[#3B82F6]',
        };
      case 'READY_FOR_PICKUP':
        return {
          label: 'Ready for Pickup',
          bg: isDarkMode ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]',
          dot: 'bg-[#10B981]',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          bg: isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]',
          dot: 'bg-[#64748B]',
        };
      case 'CANCELLED':
      case 'CUSTOMER_DECLINED':
      case 'REJECTED':
        return {
          label: 'Cancelled',
          bg: isDarkMode ? 'bg-rose-950/40 border-rose-800/60 text-rose-300' : 'bg-[#FFF1F2] border-[#FECDD3] text-[#BE123C]',
          dot: 'bg-[#F43F5E]',
        };
      default:
        return {
          label: 'Pending Review',
          bg: isDarkMode ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]',
          dot: 'bg-[#F59E0B]',
        };
    }
  }, [normStatus, isDarkMode]);

  const handleContactShop = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Contact Atelier Bay Concierge?\n\nShop: ${shopName}\nHotline: +63 (032) 489-021\nHours: 8:00 AM - 6:00 PM (Mon-Sat)\n\nClick OK to call the shop directly.`
      );
      if (confirmed) {
        window.location.href = 'tel:+63032489021';
      }
    } else {
      onToast?.('Shop Hotline: +63 (032) 489-021');
    }
  };

  // ─── LIST VIEW MODE ───
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect?.(booking)}
        className={`w-full rounded-xl border p-5 sm:p-6 transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer ${
          isSelected
            ? isDarkMode
              ? 'bg-[#18181B] border-slate-300 ring-2 ring-slate-300/15'
              : 'bg-white border-[#1E2227] ring-2 ring-[#1E2227]/10'
            : isDarkMode
            ? 'bg-[#18181B] border-[#27272A]'
            : 'bg-white border-slate-200/90'
        } ${className}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-slate-400 font-mono text-xs tracking-wider">
                REF: {bookingId}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] px-2.5 py-0.5 rounded-md">
                {shortCategory}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusConfig.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {statusConfig.label}
              </span>
            </div>

            <h3 className={`text-xl font-bold tracking-tight truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {serviceTitle}
            </h3>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-2 flex-wrap">
              <span className="bg-[#1E2227] text-white px-2.5 py-0.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {bikeDisplay}
              </span>
              {cleanPlate ? (
                <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-md text-xs font-medium inline-flex items-center gap-1">
                  <BootstrapIcon name="person-badge" size={11} color="#64748B" />
                  Plate: {cleanPlate}
                </span>
              ) : null}
              <span>•</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formattedDate} • {formattedTime}</span>
            </div>
          </div>

          <div className="flex flex-row lg:flex-col lg:items-end justify-between items-center gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div className="text-left lg:text-right">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                SERVICE TOTAL ESTIMATE
              </span>
              <span className={`text-2xl font-black font-mono tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {formatPriceNumber(totalEstimate)}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {canCancel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel?.(booking);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReschedule?.(booking);
                }}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                Reschedule
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(booking);
                  onViewDetails?.(booking);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#1E2227] hover:bg-[#282E35] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <span>View Details</span>
                <BootstrapIcon name="arrow-right" size={11} color="#FFFFFF" />
              </button>
            </div>
          </div>
        </div>

        <ServiceReceiptModal
          visible={receiptVisible}
          onClose={() => setReceiptVisible(false)}
          booking={booking}
          payments={[]}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // ─── GRID / STANDARD CARD (MATCHING USER SCREENSHOT SPECIFICATIONS) ───
  return (
    <div
      onClick={() => onSelect?.(booking)}
      className={`w-full rounded-xl border p-6 sm:p-7 transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer flex flex-col justify-between ${
        isSelected
          ? isDarkMode
            ? 'bg-[#18181B] border-slate-300 ring-2 ring-slate-300/15'
            : 'bg-white border-[#1E2227] ring-2 ring-[#1E2227]/10'
          : isDarkMode
          ? 'bg-[#18181B] border-[#27272A]'
          : 'bg-white border-slate-200/90'
      } ${className}`}
    >
      <div className="flex-1 flex flex-col justify-between">
        {/* 1. Header Row: Reference + Category Tag + Status Pill */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="text-slate-400 font-mono text-xs tracking-wider">
            REF: {bookingId}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] px-2.5 py-0.5 rounded-md">
            {shortCategory}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border ${statusConfig.bg}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>
      </div>

      {/* 2. Service Title & Price Block */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-2 mb-4">
        <div>
          <h3
            className={`text-2xl sm:text-3xl font-black tracking-tight ${
              isDarkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {serviceTitle}
          </h3>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="bg-[#1E2227] text-white px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {bikeDisplay}
            </span>

            <span className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5">
              <BootstrapIcon name="person-badge" size={12} color="#64748B" />
              Plate: {cleanPlate || 'N/A'}
            </span>
          </div>
        </div>

        <div className="text-left sm:text-right mt-2 sm:mt-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            SERVICE TOTAL ESTIMATE
          </span>
          <span
            className={`text-3xl sm:text-4xl font-black font-mono tracking-tight block ${
              isDarkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {formatPriceNumber(totalEstimate)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Incl. labor & standard fluids
          </span>
        </div>
      </div>

      {/* 3. Inset Soft Gray Meta Card (2x2 Grid) */}
      <div className="bg-[#F8FAFC] dark:bg-[#202024] rounded-xl p-5 my-5 border border-slate-100 dark:border-[#2A2A2E]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
          {/* Top-Left: Reserved Date & Pit Schedule */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#18181B] border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs shrink-0 mt-0.5">
              <BootstrapIcon name="calendar-event" size={13} color="#475569" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                RESERVED DATE & PIT SCHEDULE
              </div>
              <div className={`text-sm font-bold mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {formattedDate} • {formattedTime}
              </div>
              <div className="bg-white dark:bg-[#18181B] border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-md inline-flex items-center gap-1.5 mt-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E2227] dark:bg-slate-200" />
                {bayName}
              </div>
            </div>
          </div>

          {/* Top-Right: Service Location */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#18181B] border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs shrink-0 mt-0.5">
              <BootstrapIcon name="geo-alt" size={13} color="#475569" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SERVICE LOCATION
              </div>
              <div className={`text-sm font-bold mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {shopName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {shopAddress}
              </div>
            </div>
          </div>

          {/* Bottom-Left: Deposit Status */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#18181B] border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs shrink-0 mt-0.5">
              <BootstrapIcon name="credit-card" size={13} color="#475569" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                DEPOSIT STATUS
              </div>
              <div className={`text-sm font-bold mt-0.5 flex items-center gap-1.5 flex-wrap ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                <span>{formatPriceNumber(depositAmount)} Downpayment Verified</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300 border border-[#A7F3D0] inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  {paymentMethod}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Balance: {formatPriceNumber(balanceAmount)} payable at counter upon completion
              </div>
            </div>
          </div>

          {/* Bottom-Right: Mechanic Assignment */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#18181B] border border-slate-200/70 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs shrink-0 mt-0.5">
              <BootstrapIcon name="tools" size={13} color="#475569" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                MECHANIC ASSIGNMENT
              </div>
              <div className={`text-sm font-bold mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {mechanicName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {mechanicSub}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 4. Footer Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 mt-auto">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <BootstrapIcon name="clock" size={12} color="#94A3B8" />
            Submitted {submittedDate}
          </span>
          <button
            onClick={() => setReceiptVisible(true)}
            className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer bg-transparent border-none p-0 transition-colors"
          >
            <BootstrapIcon name="download" size={12} color="#64748B" />
            <span>Download Deposit Slip</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.(booking);
              }}
              className="px-3.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedule?.(booking);
            }}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
              isDarkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            Reschedule
          </button>
          <button
            onClick={handleContactShop}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              isDarkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BootstrapIcon name="chat-dots" size={12} color="#64748B" />
            <span>Contact Shop</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(booking);
              onViewDetails?.(booking);
            }}
            className="px-4 py-1.5 rounded-lg bg-[#1E2227] hover:bg-[#282E35] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <span>View Details</span>
            <BootstrapIcon name="arrow-right" size={12} color="#FFFFFF" />
          </button>
        </div>
      </div>

      {/* Official Service Receipt Modal */}
      <ServiceReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        booking={booking}
        payments={[]}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
