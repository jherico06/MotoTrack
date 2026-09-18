// ─── MOTOTRACK AI MOTORCYCLE CUSTOMIZER SERVICE ──────────────────────────────
import { garageService } from './garageService';
import { geminiService } from './geminiService';
import { usdToPhp } from '../utils/currency';

export const BIKE_PRESETS = [
  {
    id: 'bike-r1m',
    name: 'Yamaha YZF-R1M',
    brand: 'Yamaha',
    category: 'Superbike (1000cc)',
    color: 'Team Yamaha Blue & Silver',
    baseHp: 200,
    baseWeight: 201,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1000&q=80',
    description: 'Flagship liter-class track weapon with crossplane CP4 inline-4 engine.',
  },
  {
    id: 'bike-cbr1000',
    name: 'Honda CBR1000RR-R Fireblade SP',
    brand: 'Honda',
    category: 'Superbike (1000cc)',
    color: 'HRC Grand Prix Red / White',
    baseHp: 215,
    baseWeight: 201,
    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80',
    description: 'MotoGP aerodynamic winglets and maximum top-end rev power band.',
  },
  {
    id: 'bike-ninja',
    name: 'Kawasaki Ninja ZX-10R KRT',
    brand: 'Kawasaki',
    category: 'Superbike (1000cc)',
    color: 'Lime Green & Ebony Black',
    baseHp: 203,
    baseWeight: 207,
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80',
    description: 'WorldSBK championship winning chassis with electronic Showa BFF suspension.',
  },
  {
    id: 'bike-nmax',
    name: 'Yamaha NMAX 155 V2 Pro',
    brand: 'Yamaha',
    category: 'Maxi-Scooter (155cc)',
    color: 'Matte Dark Grey & Gold Accent',
    baseHp: 15.4,
    baseWeight: 131,
    image: 'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=1000&q=80',
    description: 'Urban performance maxi-scooter with VVA Variable Valve Actuation.',
  },
  {
    id: 'bike-panigale',
    name: 'Ducati Panigale V4 S Corse',
    brand: 'Ducati',
    category: 'Exotic Superbike (1103cc)',
    color: 'Rosso Corsa Racing Red',
    baseHp: 216,
    baseWeight: 195,
    image: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1000&q=80',
    description: 'Desmosedici Stradale 90° V4 engine with counter-rotating crankshaft.',
  },
];

export const CUSTOM_THEMES = [
  {
    id: 'theme-factory-racing',
    name: 'Factory Racing Edition',
    badge: 'Track Spec',
    description: 'High-contrast racing decals, anodized gold hardware, and titanium blue flame pipe accents.',
    accentColor: '#0C6258',
    previewGradient: ['#0C6258', '#F59E0B'],
  },
  {
    id: 'theme-stealth-carbon',
    name: 'Stealth Carbon & Titanium',
    badge: 'Ultra-Light',
    description: '3K twill matte carbon fiber body panels, billet black CNC parts, and laser-etched headers.',
    accentColor: '#334155',
    previewGradient: ['#0F172A', '#334155'],
  },
  {
    id: 'theme-cyberpunk-neon',
    name: 'Cyberpunk Neon Nights',
    badge: 'Futuristic',
    description:
      'Obsidian metallic finish with illuminated teal & magenta reflective rim stripes and LED halos.',
    accentColor: '#8B5CF6',
    previewGradient: ['#4C1D95', '#06B6D4'],
  },
  {
    id: 'theme-liquid-gold',
    name: 'Liquid Gold Superleggera',
    badge: 'Exotic Luxury',
    description: 'Forged magnesium champagne gold wheels, Öhlins gold suspension, and Brembo race calipers.',
    accentColor: '#D97706',
    previewGradient: ['#78350F', '#F59E0B'],
  },
  {
    id: 'theme-retro-custom',
    name: 'Heritage Neo-Cafe Racer',
    badge: 'Custom Classic',
    description: 'Brushed raw aluminum tank highlights, diamond-stitch saddle, and ceramic coated pipes.',
    accentColor: '#B45309',
    previewGradient: ['#451A03', '#D97706'],
  },
];

// Curated high-res photorealistic AI render gallery based on bike style & theme combinations
const AI_RENDER_GALLERY = {
  'theme-factory-racing': [
    'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85',
  ],
  'theme-stealth-carbon': [
    'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=85',
  ],
  'theme-cyberpunk-neon': [
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1200&q=85',
  ],
  'theme-liquid-gold': [
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1200&q=85',
  ],
  'theme-retro-custom': [
    'https://images.unsplash.com/photo-1558980394-4c7c9299fe96?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1200&q=85',
  ],
};

export const aiCustomizerService = {
  getPresets() {
    return BIKE_PRESETS;
  },

  getThemes() {
    return CUSTOM_THEMES;
  },

  /**
   * Calculate technical performance gains based on selected parts
   */
  calculatePerformanceGains(selectedParts = [], baseBike = null) {
    let hpGain = 0;
    let weightSavingsKg = 0;
    let brakingEfficiencyPercent = 0;
    let handlingScoreBoost = 0;
    let soundProfile = 'Factory Stock (86 dB Quiet)';
    let soundLevelDb = 86;

    selectedParts.forEach((part) => {
      const cat = (part.category || '').toLowerCase();
      const name = (part.name || '').toLowerCase();

      if (cat.includes('exhaust')) {
        hpGain += 4.8;
        weightSavingsKg += 3.6;
        soundProfile = 'Titanium Race Growl (102 dB WorldSBK Note)';
        soundLevelDb = 102;
      }
      if (
        cat.includes('engine') ||
        name.includes('dynojet') ||
        name.includes('ecu') ||
        name.includes('power')
      ) {
        hpGain += 6.5;
      }
      if (cat.includes('brake') || name.includes('brembo') || name.includes('caliper')) {
        brakingEfficiencyPercent += 16;
        weightSavingsKg += 0.8;
      }
      if (cat.includes('suspension') || name.includes('ohlins') || name.includes('damper')) {
        handlingScoreBoost += 22;
        weightSavingsKg += 1.2;
      }
      if (cat.includes('drivetrain') || name.includes('chain') || name.includes('sprocket')) {
        hpGain += 1.2;
        weightSavingsKg += 0.6;
      }
      if (cat.includes('carbon') || cat.includes('body') || name.includes('carbon')) {
        weightSavingsKg += 2.4;
      }
    });

    const baseHp = baseBike?.baseHp || 160;
    const baseWeight = baseBike?.baseWeight || 195;
    const estimatedFinalHp = Math.round((baseHp + hpGain) * 10) / 10;
    const estimatedFinalWeight = Math.max(100, Math.round((baseWeight - weightSavingsKg) * 10) / 10);
    const powerToWeightRatio = (estimatedFinalHp / (estimatedFinalWeight / 1000)).toFixed(1);

    return {
      hpGain: Math.round(hpGain * 10) / 10,
      weightSavingsKg: Math.round(weightSavingsKg * 10) / 10,
      brakingEfficiencyPercent: Math.min(35, brakingEfficiencyPercent),
      handlingScoreBoost: Math.min(30, handlingScoreBoost),
      soundProfile,
      soundLevelDb,
      baseHp,
      estimatedFinalHp,
      baseWeight,
      estimatedFinalWeight,
      powerToWeightRatio: `${powerToWeightRatio} HP/Ton`,
    };
  },

  /**
   * MODE 1: Analyze user's desired custom motorcycle photo (Inspiration / Dream Custom)
   */
  async analyzeDesiredCustomPhoto({ photoUri, userNotes = '', catalogProducts = [], onProgress }) {
    const steps = [
      'Uploading custom motorcycle inspiration photo...',
      'Scanning motorcycle chassis, fairings & livery with Gemini 3.6 Flash...',
      'Identifying equipped modifications (exhaust, calipers, suspension, bodywork)...',
      'Matching custom parts against MotoTrack Store catalog...',
      'Synthesizing dyno telemetry, acoustics & installation spec...',
    ];

    for (let i = 0; i < steps.length; i++) {
      if (typeof onProgress === 'function') {
        onProgress({
          step: i + 1,
          totalSteps: steps.length,
          message: steps[i],
          percentage: Math.round(((i + 1) / steps.length) * 100),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 380));
    }

    const analysis = await geminiService.analyzeInspirationPhoto({
      photoUri,
      userNotes,
      catalogProducts,
    });

    const matchedParts = analysis.matchedParts || [];
    const partsTotalPhp = matchedParts.reduce((acc, p) => acc + usdToPhp(p.price || 0), 0);
    const partsTotalUsd = matchedParts.reduce((acc, p) => acc + (p.price || 0), 0);

    return {
      success: true,
      customizationId: 'INSP-' + Math.floor(10000 + Math.random() * 90000),
      photoUri,
      userNotes,
      bikeStyle: analysis.bikeStyle || 'Custom Motorcycle Build',
      tagline: analysis.tagline || 'Bespoke Custom Spec',
      colorScheme: analysis.colorScheme || 'Custom Livery',
      engineeringSummary: analysis.engineeringSummary,
      detectedModifications: analysis.detectedModifications || [],
      estimatedHpGain: analysis.estimatedHpGain || 5.0,
      weightSavingsKg: analysis.weightSavingsKg || 3.5,
      exhaustSoundProfile: analysis.exhaustSoundProfile || '102 dB Sport Note',
      dynoAdvice: analysis.dynoAdvice || 'Dynojet ECU optimization suggested',
      difficultyRating: analysis.difficultyRating || 'Pitstop Custom Workshop',
      matchedParts,
      poweredBy: analysis.poweredBy || 'Google Gemini 3.6 Flash',
      partsTotalPhp: Math.round(partsTotalPhp),
      partsTotalUsd: Number(partsTotalUsd.toFixed(2)),
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Synthesize an articulate natural-language prompt sentence from
   * the selected motorcycle (registered or preset) and selected products/parts.
   */
  buildCustomizationPrompt({ motorcycle, selectedParts = [], selectedThemeId, customNotes = '' }) {
    const bikeYear = motorcycle?.year || '';
    const bikeBrand = motorcycle?.brand || 'Motorcycle';
    const bikeModel = motorcycle?.model || 'Sport';
    const bikeColor = motorcycle?.color || 'factory metallic';
    const bikeCc = motorcycle?.engine_cc ? `${motorcycle.engine_cc}cc` : '';
    const bikeNickname = motorcycle?.nickname ? `"${motorcycle.nickname}"` : '';

    const themeObj = CUSTOM_THEMES.find((t) => t.id === selectedThemeId) || CUSTOM_THEMES[0];
    const themeName = themeObj?.name || 'Factory Racing Edition';

    let partsSentence = 'stock OEM setup with factory finish';
    if (selectedParts.length === 1) {
      const p = selectedParts[0];
      const mat = p.material ? `, ${p.material}` : '';
      partsSentence = `a high-performance ${p.name} (${p.brand} ${p.category}${mat}) cleanly installed onto the motorcycle`;
    } else if (selectedParts.length > 1) {
      const partsItems = selectedParts.map((p) => {
        const mat = p.material ? ` (${p.material})` : '';
        return `${p.name} by ${p.brand}${mat}`;
      });
      partsSentence = `custom performance upgrades comprising ${partsItems.join(' and ')} seamlessly installed and calibrated onto the motorcycle`;
    }

    const bikeIdentity = [bikeYear, bikeBrand, bikeModel, bikeCc, bikeNickname]
      .filter(Boolean)
      .join(' ');

    let baseSentence = `A professional studio 4K photorealistic automotive photograph of a ${bikeIdentity} in sleek ${bikeColor} finish, custom fitted with ${partsSentence}, finished in ${themeName} styling (${themeObj.description || ''}), studio rim lighting, cinematic sharp depth of field, hyper-detailed mechanical parts, 8K ultra-realistic automotive visual render.`;

    if (customNotes && customNotes.trim().length > 0) {
      baseSentence += ` Custom aesthetic request: ${customNotes.trim()}`;
    }

    return baseSentence;
  },

  /**
   * MODE 2: AI Neural synthesis & Photorealistic Render Pipeline
   * Generates a real AI photo using the synthesized motorcycle + installed product sentence prompt.
   */
  async generateAICustomization({
    motorcycle,
    bikePhotoUri,
    bikeName,
    bikeBrand,
    selectedParts = [],
    selectedThemeId,
    customPrompt = '',
    onProgress,
  }) {
    const effectiveBikeName = motorcycle?.model || bikeName || 'Custom Motorcycle Build';
    const effectiveBikeBrand = motorcycle?.brand || bikeBrand || 'MotoTrack';
    const effectiveBasePhoto = motorcycle?.photo_url || bikePhotoUri;

    // Formulate the prompt sentence if not already customized
    const finalPrompt =
      customPrompt && customPrompt.trim().length > 0
        ? customPrompt.trim()
        : this.buildCustomizationPrompt({
            motorcycle,
            selectedParts,
            selectedThemeId,
          });

    const partsLabel =
      selectedParts.length > 0
        ? `${selectedParts.map((p) => p.name).slice(0, 2).join(', ')}${selectedParts.length > 2 ? ` + ${selectedParts.length - 2} more` : ''}`
        : 'Performance Kit';

    const steps = [
      `Scanning ${effectiveBikeBrand} ${effectiveBikeName} chassis & frame geometry...`,
      `Synthesizing custom fitment for: ${partsLabel}...`,
      'Compiling natural language prompt into high-definition diffusion tensor...',
      'Rendering photorealistic 4K AI motorcycle photo with installed parts...',
      'Finalizing dyno telemetry, acoustics & thermal diagnostics...',
    ];

    for (let i = 0; i < steps.length; i++) {
      if (typeof onProgress === 'function') {
        onProgress({
          step: i + 1,
          totalSteps: steps.length,
          message: steps[i],
          percentage: Math.round(((i + 1) / steps.length) * 100),
        });
      }
      // Realistic rendering cadence
      await new Promise((resolve) => setTimeout(resolve, 420));
    }

    // Build the AI image URL using prompt synthesis (Pollinations AI Flux model)
    const cleanPromptForUrl = finalPrompt
      .replace(/[^\w\s,.-]/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 480);

    const randomSeed = Math.floor(100000 + Math.random() * 900000);
    const aiGeneratedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPromptForUrl)}?width=1024&height=768&nologo=true&seed=${randomSeed}&model=flux`;

    // Pre-cache the image in web environment if available
    try {
      if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
        const preloader = new window.Image();
        preloader.src = aiGeneratedImageUrl;
      }
    } catch (_e) {}

    // Calculate technical diagnostics & invoke Gemini AI Vision analysis
    const themeObj = CUSTOM_THEMES.find((t) => t.id === selectedThemeId);
    let geminiAnalysis = null;
    try {
      geminiAnalysis = await geminiService.analyzeCustomBuild({
        bikePhotoUri: effectiveBasePhoto,
        bikeName: effectiveBikeName,
        bikeBrand: effectiveBikeBrand,
        selectedParts,
        selectedThemeName: themeObj?.name || 'Factory Racing Edition',
        customPrompt: finalPrompt,
      });
    } catch (_err) {
      console.warn('Gemini analysis note:', _err);
    }

    const diagnostics = this.calculatePerformanceGains(selectedParts, {
      name: effectiveBikeName,
      brand: effectiveBikeBrand,
      baseHp: geminiAnalysis?.estimatedHpGain ? 160 + geminiAnalysis.estimatedHpGain : undefined,
    });

    const partsTotalPhp = selectedParts.reduce((acc, p) => acc + usdToPhp(p.price || 0), 0);
    const partsTotalUsd = selectedParts.reduce((acc, p) => acc + (p.price || 0), 0);

    return {
      success: true,
      customizationId: 'AI-CUST-' + Math.floor(10000 + Math.random() * 90000),
      originalImage: effectiveBasePhoto,
      generatedImage: aiGeneratedImageUrl,
      promptUsed: finalPrompt,
      bikeName: effectiveBikeName,
      bikeBrand: effectiveBikeBrand,
      motorcycle,
      selectedThemeId,
      customPrompt: finalPrompt,
      selectedParts,
      diagnostics,
      geminiAnalysis,
      partsTotalPhp: Math.round(partsTotalPhp),
      partsTotalUsd: Number(partsTotalUsd.toFixed(2)),
      createdAt: new Date().toISOString(),
    };
  },


  /**
   * Book a customization service at MotoTrack Pitstop Garage
   */
  async bookCustomizationService({
    customizationData,
    branchName,
    appointmentDate,
    timeSlot,
    customerName,
    customerPhone,
    plateNumber,
    notes,
    currentUser,
  }) {
    const partsNames = (customizationData?.selectedParts || []).map((p) => p.name).join(' + ');
    const partsCost = customizationData?.partsTotalUsd || 150;
    const installationFee = 65.0; // Professional installation fee in USD
    const totalEstUsd = partsCost + installationFee;
    const totalEstPhp = usdToPhp(totalEstUsd);

    const bookingPayload = {
      category: 'Customization',
      service_id: 'cust-ai-bespoke',
      service_title: `AI Custom Build: ${customizationData?.bikeName || 'Motorcycle'}`,
      service_price: totalEstUsd,
      pricePhp: totalEstPhp,
      bike_brand: customizationData?.bikeBrand || 'Motorcycle',
      bike_model: customizationData?.bikeName || 'Custom Model',
      plate_number: plateNumber || 'Pending Plate',
      odometer: 'Custom Project',
      appointment_date: appointmentDate || 'Tomorrow, 10:30 AM',
      time_slot: timeSlot || '10:30 AM - 12:00 PM',
      branch: branchName || 'MotoTrack Flagship Central Hub - Quezon City',
      customer_name: customerName || currentUser?.name || 'MotoTrack Rider',
      customer_phone: customerPhone || '+63 917 882 9102',
      customer_id: currentUser?.customer_id || currentUser?.id || 'guest',
      notes: `[AI Customizer Build #${customizationData?.customizationId}]\nEquipped Parts: ${partsNames}\n${notes || ''}`,
      ai_custom_image: customizationData?.generatedImage,
      custom_parts_list: customizationData?.selectedParts,
      performance_gain: `+${customizationData?.diagnostics?.hpGain || 0} HP, -${customizationData?.diagnostics?.weightSavingsKg || 0} kg`,
    };

    const newBooking = await garageService.createBooking(bookingPayload);
    return newBooking;
  },
};
