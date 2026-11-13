import React from 'react';

/**
 * MotoTrack Custom Frameless Category Icons
 * Matching the exact visual style of the reference UI.
 */
export default function CategoryIcon({ name, color = 'currentColor', size = 26 }) {
  const norm = String(name || '').trim().toLowerCase();

  // 1. Accessories (shopping bag with handle)
  if (norm.includes('access') || norm.includes('bag') || norm.includes('gear')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  }

  // 2. Brakes (disc brake rotor with ventilation cutouts and holes)
  if (norm.includes('brake') || norm.includes('rotor') || norm.includes('caliper') || norm.includes('pad')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        <circle cx="6.5" cy="6.5" r="0.8" fill={color} stroke="none" />
        <circle cx="17.5" cy="6.5" r="0.8" fill={color} stroke="none" />
        <circle cx="6.5" cy="17.5" r="0.8" fill={color} stroke="none" />
        <circle cx="17.5" cy="17.5" r="0.8" fill={color} stroke="none" />
      </svg>
    );
  }

  // 3. Drivetrain (sprocket with teeth and inner cutouts)
  if (norm.includes('drivetrain') || norm.includes('chain') || norm.includes('sprocket')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.5" />
        <path d="M12 2l1.2 2.2 2.4-.4.8 2.4 2.5.7-.3 2.5 2 1.5-1.2 2.3 1.2 2.3-2 1.5.3 2.5-2.5.7-.8 2.4-2.4-.4L12 22l-1.2-2.2-2.4.4-.8-2.4-2.5-.7.3-2.5-2-1.5 1.2-2.3-1.2-2.3 2-1.5-.3-2.5 2.5-.7.8-2.4 2.4.4z" />
      </svg>
    );
  }

  // 4. Engine (engine cylinder block with horizontal cooling fins)
  if (norm.includes('engine') || norm.includes('motor') || norm.includes('cylinder') || norm.includes('piston')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
        <path d="M2 13h2M20 13h2M2 17h2M20 17h2" />
        <path d="M7 6h10l-1 4H8L7 6z" />
        <path d="M10 3h4v3h-4z" />
        <path d="M10 14l2-2 2 2" />
        <path d="M12 12v5" />
      </svg>
    );
  }

  // 5. Exhaust (sleek curved flame plume)
  if (norm.includes('exhaust') || norm.includes('pipe') || norm.includes('muffler')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-2-1.5-3-2-4.5-.5 1.5-1 2-1.5 2-.5 0-1-.5-1-1 0-1.5 1.5-3 1.5-5-2.5 1.5-5 5-4 8.5z" />
        <path d="M12 2.5c1.5 3 4.5 4.5 5 7.5a6.5 6.5 0 1 1-13 0c.5-3 3.5-4.5 5-7.5" />
      </svg>
    );
  }

  // 6. Maintenance (clean diagonal mechanical wrench)
  if (norm.includes('maintenance') || norm.includes('oil') || norm.includes('service') || norm.includes('lubricant')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <path d="M14.7 6.3a4.5 4.5 0 0 0-6.1 6.1L3 18l3 3 5.6-5.6a4.5 4.5 0 0 0 6.1-6.1l-2.4 2.4-2.6-2.6 2-2.1z" />
      </svg>
    );
  }

  // 7. Suspension (coilover shock absorber with spring coils)
  if (norm.includes('suspension') || norm.includes('shock') || norm.includes('fork') || norm.includes('damper')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <circle cx="12" cy="3.5" r="1.5" />
        <line x1="12" y1="5" x2="12" y2="7.5" />
        <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
        <path d="M9 8.5l6 2.2-6 2.2 6 2.2-6 2.2h6" />
        <line x1="8.5" y1="18" x2="15.5" y2="18" />
        <line x1="12" y1="18" x2="12" y2="20.5" />
        <circle cx="12" cy="21.5" r="1" />
      </svg>
    );
  }

  // 8. Tires (motorcycle tire wheel rim with radial tread marks)
  if (norm.includes('tire') || norm.includes('wheel') || norm.includes('rim')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, display: 'block' }}
      >
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.5" />
        <line x1="12" y1="2.5" x2="12" y2="4.5" />
        <line x1="12" y1="19.5" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="4.5" y2="12" />
        <line x1="19.5" y1="12" x2="21.5" y2="12" />
        <line x1="5.3" y1="5.3" x2="6.7" y2="6.7" />
        <line x1="17.3" y1="17.3" x2="18.7" y2="18.7" />
        <line x1="5.3" y1="18.7" x2="6.7" y2="17.3" />
        <line x1="17.3" y1="6.7" x2="18.7" y2="5.3" />
      </svg>
    );
  }

  // 9. "More" (2x2 grid icon) or fallback
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, display: 'block' }}
    >
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

