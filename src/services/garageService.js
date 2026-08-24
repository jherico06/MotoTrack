// Garage & Service Booking Service for MotoTrack (PMS & Customization)
import { storageAdapter } from './storageAdapter';
import { supabaseManager } from './supabaseClient';

export const GARAGE_SERVICES = [
  {
    id: 'pms-pro',
    category: 'PMS',
    categoryName: 'Preventive Maintenance',
    title: 'Pro Performance Full PMS',
    subtitle: 'Comprehensive 42-point Track Inspection & Fluid Service',
    price: 75.0,
    pricePhp: 3750,
    duration: '90 mins',
    badge: 'Most Popular',
    icon: 'wrench-adjustable',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    description: 'Complete high-performance preventive maintenance service for superbike and sport riders.',
    inclusions: [
      'Motul 300V Factory Line 100% Synthetic Oil Change',
      'OEM/K&N High-Flow Oil Filter Replacement',
      'Spark Plug Gap & Compression Check',
      'Brake Line Bleed with Motul RBF 660 DOT4',
      'Drive Chain Deep Cleaning, Tensioning & Wax',
      'Throttle Body & Injector Cleaning',
      'Coolant System Specific Gravity Check',
      'Chassis Fasteners Torque Inspection',
    ],
  },
  {
    id: 'pms-quick',
    category: 'PMS',
    categoryName: 'Preventive Maintenance',
    title: 'Quick Express Oil & Lube Pit',
    subtitle: 'Fast 30-min Synthetic Oil, Filter & Chain Service',
    price: 35.0,
    pricePhp: 1750,
    duration: '30 mins',
    badge: 'Express',
    icon: 'speedometer',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
    description: 'Rapid turnaround service for busy daily riders and weekend warriors.',
    inclusions: [
      'Fully Synthetic Engine Oil Replacement',
      'Magnetic Drain Plug Inspection & Crush Washer',
      'Tire Pressure & Tread Depth Scan',
      'Drive Chain Degrease & Synthetic Lube',
      'Battery Voltage & Charging Alternator Test',
    ],
  },
  {
    id: 'cust-exhaust',
    category: 'Customization',
    categoryName: 'Customization & Tuning',
    title: 'Full System Exhaust Fitting & Dyno Tuning',
    subtitle: 'Slip-On or Full Titanium Header Installation & ECU Fuel Map',
    price: 120.0,
    pricePhp: 6000,
    duration: '120 mins',
    badge: 'Dyno Verified',
    icon: 'fire',
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80',
    description: 'Expert exhaust fabrication and Dynojet 250i chassis dyno fuel calibration.',
    inclusions: [
      'Exhaust Header & Link Pipe Fitting with Anti-Seize',
      'Exup Valve Servo Eliminator / Flashing',
      'Dynojet Dual-Sensor Wideband AFR Tuning',
      'Before & After Horsepower Dyno Printout',
      'Heat Shield & O2 Sensor Sensor Calibration',
    ],
  },
  {
    id: 'cust-suspension',
    category: 'Customization',
    categoryName: 'Customization & Tuning',
    title: 'Track Sag Calibration & Suspension Setup',
    subtitle: 'Front Fork & Rear Shock Spring Preload / Damping Tune',
    price: 65.0,
    pricePhp: 3250,
    duration: '60 mins',
    badge: 'Pro Setup',
    icon: 'gear-wide-connected',
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=600&q=80',
    description: 'Custom suspension geometry dialed in specifically to rider gear weight and track riding style.',
    inclusions: [
      'Rider Static & Dynamic Sag Measurement',
      'Front Fork Compression & Rebound Clicker Setup',
      'Rear Shock High/Low Speed Damping Tuning',
      'Tire Contact Patch Wear Analysis & Guidance',
      'Personalized Track Suspension Baseline Sheet',
    ],
  },
];

export const GARAGE_BRANCHES = [
  {
    id: 'branch-qc',
    name: 'MotoTrack Flagship Central Hub - Quezon City',
    address: '142 Katipunan Ave, Quezon City, Metro Manila',
    bays: '8 Pit Bays • Dynojet 250i Cell',
    phone: '+63 (2) 8920-4100',
    hours: 'Mon - Sun: 8:00 AM - 7:00 PM',
  },
  {
    id: 'branch-south',
    name: 'MotoTrack South SuperPit - Alabang',
    address: 'Commerce Ave, Filinvest City, Alabang, Muntinlupa',
    bays: '6 Pit Bays • Suspension Center',
    phone: '+63 (2) 8771-9200',
    hours: 'Mon - Sat: 8:30 AM - 6:30 PM',
  },
  {
    id: 'branch-east',
    name: 'MotoTrack East Garage - Pasig',
    address: 'Ortigas Ave Extension, Pasig City',
    bays: '5 Pit Bays • Quick PMS Express',
    phone: '+63 (2) 8631-5500',
    hours: 'Tue - Sun: 9:00 AM - 6:00 PM',
  },
];

export const TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '10:30 AM - 12:00 PM',
  '01:30 PM - 03:00 PM',
  '03:00 PM - 04:30 PM',
  '04:30 PM - 06:00 PM',
];

const GARAGE_STORAGE_KEY = 'mototrack_garage_bookings';
const GARAGE_SERVICES_STORAGE_KEY = 'mototrack_garage_services_list';

const INITIAL_DEMO_BOOKINGS = [
  {
    id: 'BK-PMS-8012',
    booking_id: 'BK-PMS-8012',
    service_id: 'pms-pro',
    service_title: 'Pro Performance Full PMS',
    category: 'PMS',
    service_price: 75.0,
    bike_brand: 'Yamaha',
    bike_model: 'NMAX 155 (2024 V2)',
    plate_number: 'NMX-8891',
    odometer: '8,420 km',
    appointment_date: 'Tomorrow, 10:30 AM',
    time_slot: '10:30 AM - 12:00 PM',
    branch: 'MotoTrack Flagship Central Hub - Quezon City',
    customer_name: 'Alex Rider',
    customer_phone: '+63 917 882 9102',
    status: 'Confirmed',
    mechanic: 'Master Tech Jayson (Yamaha Certified)',
    notes: 'Please double check front brake squeak during low speed stops.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const serviceListeners = new Set();

export const garageService = {
  subscribe(callback) {
    if (typeof callback === 'function') {
      serviceListeners.add(callback);
      return () => serviceListeners.delete(callback);
    }
    return () => {};
  },

  notifyListeners() {
    serviceListeners.forEach((fn) => {
      try {
        fn(this.getServices());
      } catch (e) {
        console.warn('Error in garageService listener:', e);
      }
    });
  },

  // ─── SERVICES CRUD (SUPABASE PRIMARY) ───
  async fetchServices() {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        const { data, error } = await client
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const normalized = data.map((item) => ({
            id: item.service_id || item.id,
            service_id: item.service_id || item.id,
            category: item.category || 'PMS',
            categoryName:
              item.category === 'PMS'
                ? 'Preventive Maintenance'
                : 'Customization & Tuning',
            title: item.name || item.title || 'Garage Service',
            subtitle: item.subtitle || 'Professional Motorcycle Service',
            price: Number(item.price || 0),
            pricePhp: item.price_php ? Number(item.price_php) : Math.round(Number(item.price || 0) * 50),
            duration: item.duration || '60 mins',
            badge: item.badge || 'Popular',
            icon: item.category === 'PMS' ? 'wrench-adjustable' : 'tools',
            image: item.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
            description: item.description || '',
            inclusions: Array.isArray(item.inclusions)
              ? item.inclusions
              : typeof item.inclusions === 'string'
              ? JSON.parse(item.inclusions || '[]')
              : [],
          }));

          this.saveServices(normalized);
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase fetchServices note:', e);
    }
    return this.getServices();
  },

  getServices() {
    try {
      const saved = storageAdapter.getItem(GARAGE_SERVICES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return GARAGE_SERVICES;
  },

  saveServices(services) {
    try {
      storageAdapter.setItem(GARAGE_SERVICES_STORAGE_KEY, JSON.stringify(services));
      this.notifyListeners();
    } catch (e) {}
  },

  async addService(serviceData) {
    const services = this.getServices();
    const id = serviceData.id || `srv-${Date.now()}`;
    const priceNum = Number(serviceData.price) || 0;
    const pricePhp = serviceData.pricePhp || Math.round(priceNum * 50);
    const inclusionsList = Array.isArray(serviceData.inclusions)
      ? serviceData.inclusions
      : (serviceData.inclusions || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    const newService = {
      id,
      service_id: id,
      category: serviceData.category || 'PMS',
      categoryName:
        serviceData.category === 'PMS'
          ? 'Preventive Maintenance'
          : 'Customization & Tuning',
      title: serviceData.title || 'New Garage Service',
      subtitle: serviceData.subtitle || 'Professional Motorcycle Service',
      price: priceNum,
      pricePhp,
      duration: serviceData.duration || '60 mins',
      badge: serviceData.badge || 'New Service',
      icon: serviceData.icon || (serviceData.category === 'PMS' ? 'wrench-adjustable' : 'tools'),
      image:
        serviceData.image ||
        'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
      description: serviceData.description || 'Quality professional motorcycle service and maintenance.',
      inclusions: inclusionsList,
    };

    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('services').insert([
          {
            service_id: id,
            name: newService.title,
            category: newService.category,
            subtitle: newService.subtitle,
            price: newService.price,
            price_php: newService.pricePhp,
            duration: newService.duration,
            badge: newService.badge,
            image: newService.image,
            description: newService.description,
            inclusions: inclusionsList,
            status: 'active',
          },
        ]);
      }
    } catch (e) {
      console.warn('Supabase service insert error:', e);
    }

    const updated = [newService, ...services];
    this.saveServices(updated);
    return newService;
  },

  async updateService(serviceId, updatedData) {
    const services = this.getServices();
    const priceNum = updatedData.price !== undefined ? Number(updatedData.price) : undefined;
    const pricePhp = priceNum !== undefined ? Math.round(priceNum * 50) : undefined;

    try {
      const client = supabaseManager.getClient();
      if (client) {
        const updatePayload = {
          updated_at: new Date().toISOString(),
        };
        if (updatedData.title) updatePayload.name = updatedData.title;
        if (updatedData.category) updatePayload.category = updatedData.category;
        if (updatedData.subtitle !== undefined) updatePayload.subtitle = updatedData.subtitle;
        if (priceNum !== undefined) {
          updatePayload.price = priceNum;
          updatePayload.price_php = pricePhp;
        }
        if (updatedData.duration) updatePayload.duration = updatedData.duration;
        if (updatedData.badge !== undefined) updatePayload.badge = updatedData.badge;
        if (updatedData.image) updatePayload.image = updatedData.image;
        if (updatedData.description !== undefined) updatePayload.description = updatedData.description;
        if (updatedData.inclusions) {
          updatePayload.inclusions = Array.isArray(updatedData.inclusions)
            ? updatedData.inclusions
            : updatedData.inclusions.split('\n').map((s) => s.trim()).filter(Boolean);
        }

        await client.from('services').update(updatePayload).eq('service_id', serviceId);
      }
    } catch (e) {
      console.warn('Supabase service update error:', e);
    }

    const updated = services.map((s) => {
      if (s.id === serviceId || s.service_id === serviceId) {
        return {
          ...s,
          ...updatedData,
          price: priceNum !== undefined ? priceNum : s.price,
          pricePhp: pricePhp !== undefined ? pricePhp : s.pricePhp,
          categoryName:
            (updatedData.category || s.category) === 'PMS'
              ? 'Preventive Maintenance'
              : 'Customization & Tuning',
        };
      }
      return s;
    });
    this.saveServices(updated);
    return updated;
  },

  async deleteService(serviceId) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('services').delete().eq('service_id', serviceId);
      }
    } catch (e) {
      console.warn('Supabase service delete error:', e);
    }

    const services = this.getServices();
    const updated = services.filter((s) => s.id !== serviceId && s.service_id !== serviceId);
    this.saveServices(updated);
    return updated;
  },

  getBranches() {
    return GARAGE_BRANCHES;
  },

  getTimeSlots() {
    return TIME_SLOTS;
  },

  // ─── BOOKINGS CRUD (SUPABASE PRIMARY) ───
  async fetchBookings(customerId) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        let query = client.from('bookings').select('*').order('created_at', { ascending: false });
        if (customerId) {
          query = query.eq('customer_id', customerId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const normalized = data.map((b) => ({
            id: b.booking_id || b.id,
            booking_id: b.booking_id || b.id,
            customer_id: b.customer_id,
            service_id: b.service_id,
            service_title: b.notes || 'Garage Service Appointment',
            bike_brand: b.bike_brand || 'Motorcycle',
            bike_model: b.bike_model || '',
            plate_number: b.bike_plate || 'No Plate',
            odometer: b.bike_odo || '',
            appointment_date: b.schedule ? new Date(b.schedule).toLocaleDateString() : 'Scheduled',
            time_slot: b.schedule ? new Date(b.schedule).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Slot 1',
            branch: b.branch_name || 'MotoTrack Hub',
            customer_name: b.customer_name || 'Customer',
            customer_phone: b.customer_phone || '',
            status: b.status || 'Confirmed',
            mechanic: b.mechanic || 'Assigned Specialist',
            notes: b.notes || '',
            created_at: b.created_at,
          }));
          this.saveLocalBookings(normalized);
          return normalized;
        }
      }
    } catch (e) {
      console.warn('Supabase fetchBookings error:', e);
    }
    return this.getLocalBookings();
  },

  getLocalBookings() {
    try {
      const saved = storageAdapter.getItem(GARAGE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return INITIAL_DEMO_BOOKINGS;
  },

  saveLocalBookings(bookings) {
    try {
      storageAdapter.setItem(GARAGE_STORAGE_KEY, JSON.stringify(bookings));
    } catch (e) {}
  },

  async createBooking(newBookingData) {
    const bookingId =
      'BK-' +
      (newBookingData.category === 'PMS' ? 'PMS' : 'CUST') +
      '-' +
      Math.floor(1000 + Math.random() * 9000);

    const booking = {
      id: bookingId,
      booking_id: bookingId,
      status: 'Confirmed',
      created_at: new Date().toISOString(),
      mechanic: 'MotoTrack Assigned Specialist',
      ...newBookingData,
    };

    // 1. Sync to Supabase
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client.from('bookings').insert([
          {
            booking_id: bookingId,
            customer_id: newBookingData.customer_id || newBookingData.userId || 'guest',
            service_id: newBookingData.service_id || newBookingData.serviceId || 'srv-gen',
            schedule: new Date().toISOString(),
            bike_brand: newBookingData.bike_brand || '',
            bike_model: newBookingData.bike_model || '',
            bike_plate: newBookingData.plate_number || newBookingData.bike_plate || '',
            bike_odo: newBookingData.odometer || newBookingData.bike_odo || '',
            branch_name: newBookingData.branch || newBookingData.branch_name || 'Flagship Central Hub',
            mechanic: 'MotoTrack Assigned Specialist',
            customer_name: newBookingData.customer_name || '',
            customer_phone: newBookingData.customer_phone || '',
            notes: newBookingData.notes || '',
            price: newBookingData.service_price || newBookingData.price || 0,
            status: 'Confirmed',
          },
        ]);
      }
    } catch (e) {
      console.warn('Supabase booking insert error:', e);
    }

    // 2. Save locally
    const current = this.getLocalBookings();
    const updated = [booking, ...current];
    this.saveLocalBookings(updated);
    return booking;
  },

  async cancelBooking(bookingId) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client
          .from('bookings')
          .update({ status: 'Cancelled' })
          .eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase cancel booking error:', e);
    }

    const current = this.getLocalBookings();
    const updated = current.map((b) =>
      b.id === bookingId || b.booking_id === bookingId ? { ...b, status: 'Cancelled' } : b
    );
    this.saveLocalBookings(updated);
    return updated;
  },

  async rescheduleBooking(bookingId, newDate, newSlot) {
    try {
      const client = supabaseManager.getClient();
      if (client) {
        await client
          .from('bookings')
          .update({
            rescheduled_at: new Date().toISOString(),
            status: 'Confirmed',
          })
          .eq('booking_id', bookingId);
      }
    } catch (e) {
      console.warn('Supabase reschedule error:', e);
    }

    const current = this.getLocalBookings();
    const updated = current.map((b) =>
      b.id === bookingId || b.booking_id === bookingId
        ? {
            ...b,
            appointment_date: newDate,
            time_slot: newSlot,
            status: 'Confirmed',
          }
        : b
    );
    this.saveLocalBookings(updated);
    return updated;
  },

  getUserBookings(userEmail) {
    const all = this.getLocalBookings();
    if (!userEmail) return all;
    return all.filter((b) =>
      (b.customer_email && b.customer_email.toLowerCase() === userEmail.toLowerCase()) ||
      (b.userEmail && b.userEmail.toLowerCase() === userEmail.toLowerCase()) ||
      (b.customer_name && b.customer_name.toLowerCase() === userEmail.toLowerCase())
    );
  },

  addBooking(bookingData) {
    return this.createBooking(bookingData);
  },
};
