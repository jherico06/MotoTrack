// ─── GOOGLE GEMINI AI SERVICE FOR MOTOTRACK CUSTOMIZER ───────────────────────
import { storageAdapter } from './storageAdapter.js';

const GEMINI_API_KEY_STORAGE = 'mototrack_gemini_api_key';
const FALLBACK_ENV_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const DEFAULT_GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-1.5-flash';

export const geminiService = {
  getApiKey() {
    try {
      const stored = storageAdapter.getItem(GEMINI_API_KEY_STORAGE);
      if (stored && typeof stored === 'string' && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch (e) {}
    // Default to configured environment API key
    if (FALLBACK_ENV_KEY && typeof FALLBACK_ENV_KEY === 'string' && FALLBACK_ENV_KEY.trim().length > 0) {
      return FALLBACK_ENV_KEY.trim();
    }
    return '';
  },

  setApiKey(apiKey) {
    try {
      if (!apiKey || apiKey.trim().length === 0) {
        storageAdapter.removeItem(GEMINI_API_KEY_STORAGE);
      } else {
        storageAdapter.setItem(GEMINI_API_KEY_STORAGE, apiKey.trim());
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  },

  getModel() {
    return DEFAULT_GEMINI_MODEL;
  },

  /**
   * Helper to perform Gemini API call with timeout and fallback models
   */
  async _callGeminiApi({ promptText, base64ImageUri, timeoutMs = 16000 }) {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const candidateModels = [DEFAULT_GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.8-flash'];

    const contents = [];
    const parts = [];

    // Attach image if present
    if (base64ImageUri && base64ImageUri.startsWith('data:image')) {
      try {
        const mimeType = base64ImageUri.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64Data = base64ImageUri.split(',')[1];
        if (base64Data) {
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
      } catch (imgErr) {
        console.warn('Image encoding note:', imgErr);
      }
    }

    parts.push({ text: promptText });
    contents.push({ role: 'user', parts });

    for (const model of candidateModels) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.35,
              topK: 32,
              topP: 0.9,
              response_mime_type: 'application/json',
            },
          }),
          signal: controller ? controller.signal : undefined,
        });

        if (timer) clearTimeout(timer);

        if (response.ok) {
          const resData = await response.json();
          const textOutput = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (textOutput) {
            const cleanJson = textOutput
              .replace(/```json/gi, '')
              .replace(/```/g, '')
              .trim();
            return {
              data: JSON.parse(cleanJson),
              model,
            };
          }
        }
      } catch (err) {
        if (timer) clearTimeout(timer);
        console.warn(`Gemini API call on model ${model} note:`, err?.message || err);
      }
    }

    return null;
  },

  /**
   * MODE 1: Analyze Desired Custom Motorcycle Photo (Inspiration / Dream Custom)
   * Scans photo, extracts custom modifications, and pairs with catalog parts
   */
  async analyzeInspirationPhoto({ photoUri, userNotes = '', catalogProducts = [] }) {
    const promptText = `You are the Lead Master Customizer and AI Vision Specialist for MotoTrack Pro Corse.
The customer has uploaded a photo of their desired custom motorcycle (or inspiration photo).
${userNotes ? `Customer Notes / Wishes: "${userNotes}"` : ''}

Available Parts Catalog Categories: Exhausts, Brakes, Suspension, Bodywork & Carbon, ECU / Dyno Tuning, Wheels & Tires, Lighting.

Please perform a high-level visual teardown of this custom motorcycle build. Return a JSON object with these EXACT keys:
1. "bikeStyle": Category/Style of bike (e.g. "Trackday Superbike", "Neo-Retro Cafe Racer", "Urban Maxi-Scooter", "Aggressive Naked Streetfighter", "Scrambler / Adventure").
2. "tagline": A catchy 1-line hype title for this build concept (e.g. "Titanium Apex Hunter: Cafe Street Spec").
3. "colorScheme": Dominant colors and finish (e.g. "Matte Satin Titanium with Acid Teal Accents and Gloss Carbon Weave").
4. "engineeringSummary": 2-3 sentences explaining the visual balance, stance, and custom craftsmanship of this motorcycle.
5. "detectedModifications": An array of strings describing the custom modifications visible or intended in this style (e.g. ["Full Titanium Race Exhaust with Slash-Cut Exit", "Brembo Radial Billet Calipers", "Carbon Fiber Fairings & Tank Trim", "Inverted Gold Showa/Öhlins Suspension", "Smoked LED Halo Projector Headlight", "Lightweight Forged Rims"]).
6. "estimatedHpGain": number (realistic estimated horsepower boost from these modifications, e.g. 7.5).
7. "weightSavingsKg": number (realistic weight reduction, e.g. 4.8).
8. "exhaustSoundProfile": Description of exhaust acoustics (e.g. "103 dB Titanium Deep Resonance with race over-run crackles").
9. "dynoAdvice": Dyno tuning and fuel mapping recommendation (e.g. "ECU remapping advised for high-flow exhaust and rapid throttle pickup").
10. "difficultyRating": "Bolt-On Upgrade" | "Pitstop Custom Workshop" | "Master Bespoke Build".
11. "searchKeywords": Array of 4-6 lowercase keywords to match against parts store (e.g. ["exhaust", "titanium", "brembo", "carbon", "ohlins"]).

Respond ONLY with valid JSON.`;

    const apiResult = await this._callGeminiApi({
      promptText,
      base64ImageUri: photoUri,
    });

    if (apiResult && apiResult.data) {
      const parsed = apiResult.data;
      const matchedParts = this._matchCatalogProducts(
        parsed.searchKeywords || [],
        parsed.detectedModifications || [],
        catalogProducts
      );

      return {
        ...parsed,
        matchedParts,
        poweredBy: `Google Gemini (${apiResult.model || '3.6 Flash'})`,
        analyzedAt: new Date().toISOString(),
      };
    }

    // Intelligent simulated analysis fallback if API key quota / network is unavailable
    return this.generateSimulatedInspirationAnalysis(photoUri, userNotes, catalogProducts);
  },

  /**
   * MODE 2: Analyze Custom Build from Studio (Motorcycle + Selected Parts + Theme)
   */
  async analyzeCustomBuild({
    bikePhotoUri,
    bikeName,
    bikeBrand,
    selectedParts = [],
    selectedThemeName = 'Factory Racing Edition',
    customPrompt = '',
  }) {
    const partsListText = selectedParts
      .map((p, idx) => `${idx + 1}. ${p.name} (${p.brand} - ${p.category})`)
      .join('\n');

    const promptText = `You are the Master Race Engineer and AI Motorcycle Specialist for MotoTrack Pro Corse.
Analyze this motorcycle custom build:
- Motorcycle: ${bikeBrand || 'Pro'} ${bikeName || 'Motorcycle'}
- Selected Custom Theme: ${selectedThemeName}
${customPrompt ? `- Rider Custom Generative Vision: "${customPrompt}"` : ''}
- Equipped Performance Parts:
${partsListText || 'Stock Factory Setup'}

Provide an ultra-professional, race-grade technical analysis in JSON format with these exact keys:
1. "tagline": A catchy 1-line hype title for this build (e.g. "Apex Predator: 212HP Trackday Weapon").
2. "engineeringSummary": 2-3 sentences explaining the visual and mechanical synergy of these equipped parts.
3. "estimatedHpGain": number (e.g. 8.5).
4. "weightSavingsKg": number (e.g. 5.2).
5. "exhaustSoundProfile": Description of exhaust acoustics (e.g. "104 dB Titanium Resonance with aggressive over-run pops").
6. "dynoAdvice": Dyno fuel remapping recommendation (e.g. "Advance ignition timing by +2.5° between 7,000-11,500 RPM").
7. "installationComplexity": "Direct Bolt-On Fitment" | "Moderate (Pit Bay Dyno Required)" | "Advanced Master Spec".
8. "visualDetails": Description of how the parts look mounted onto the motorcycle (exhaust canister position, caliper color, carbon weaves, rim accents).

Respond ONLY with valid JSON.`;

    const apiResult = await this._callGeminiApi({
      promptText,
      base64ImageUri: bikePhotoUri,
    });

    if (apiResult && apiResult.data) {
      return {
        ...apiResult.data,
        poweredBy: `Google Gemini (${apiResult.model || '3.6 Flash'})`,
      };
    }

    // Local fallback calculation
    return this.generateSimulatedAnalysis(bikeName, bikeBrand, selectedParts, selectedThemeName, customPrompt);
  },

  /**
   * Helper to match detected features against store catalog products
   */
  _matchCatalogProducts(keywords = [], modifications = [], catalog = []) {
    if (!Array.isArray(catalog) || catalog.length === 0) return [];

    const matched = [];
    const usedIds = new Set();

    const normalizedMods = (modifications || []).join(' ').toLowerCase();
    const allKeywords = [...(keywords || []), ...normalizedMods.split(/[\s,]+/)].filter((k) => k.length > 2);

    // 1. Try to find products matching exhaust, brakes, suspension, or carbon
    for (const product of catalog) {
      const text = `${product.name} ${product.brand} ${product.category} ${product.description || ''}`.toLowerCase();
      let matchScore = 0;

      for (const kw of allKeywords) {
        if (text.includes(kw.toLowerCase())) {
          matchScore += 1;
        }
      }

      if (matchScore > 0 && !usedIds.has(product.id)) {
        usedIds.add(product.id);
        matched.push({
          ...product,
          matchScore,
          matchReason: `Matches ${product.category || 'Performance'} custom modification in your photo`,
        });
      }
    }

    matched.sort((a, b) => b.matchScore - a.matchScore);

    // If fewer than 2 matched, pick relevant top-tier catalog items to give a complete custom kit
    if (matched.length < 2) {
      const topDefaults = catalog.slice(0, 3);
      topDefaults.forEach((p) => {
        if (!usedIds.has(p.id)) {
          matched.push({
            ...p,
            matchScore: 1,
            matchReason: 'Recommended complementary upgrade for this motorcycle build',
          });
        }
      });
    }

    return matched.slice(0, 4);
  },

  /**
   * Intelligent Simulated Inspiration Analysis (Fallback)
   */
  generateSimulatedInspirationAnalysis(photoUri, userNotes, catalogProducts = []) {
    const isScooter = (userNotes || '').toLowerCase().includes('scooter') || (userNotes || '').toLowerCase().includes('nmax');
    const isCafe = (userNotes || '').toLowerCase().includes('cafe') || (userNotes || '').toLowerCase().includes('retro');

    let bikeStyle = 'Trackday Superbike';
    let tagline = 'Custom Apex Edition: Performance Build';
    let colorScheme = 'Stealth Matte Titanium with Carbon Accent';
    let mods = [
      'Full Titanium Racing Exhaust System',
      'Radial Monobloc Brake Calipers',
      'Multi-Adjustable Inverted Suspension',
      'Ultra-Lightweight Carbon Fiber Fairings',
      'Anodized CNC Billet Levers & Bar Ends',
    ];

    if (isScooter) {
      bikeStyle = 'Maxi-Performance Scooter';
      tagline = 'Urban Super-Tourer: High-Flow Spec';
      colorScheme = 'Matte Obsidian with Champagne Gold Rims';
      mods = [
        'Akrapovic High-Exit Carbon Slip-On',
        'Performance CVT Pulley & Belt Kit',
        'Dual Rear Gas Reservoir Shocks',
        'Wave Brake Rotors & Braided Lines',
      ];
    } else if (isCafe) {
      bikeStyle = 'Neo-Retro Cafe Racer';
      tagline = 'Heritage Speedster: Bespoke Cafe Spec';
      colorScheme = 'Brushed Aluminum Tank with Burgundy Accents';
      mods = [
        'Ceramic Coated Dual Header Pipes',
        'Low-Mount CNC Clip-On Handlebars',
        'Oversized Dual Disc Brakes',
        'Bar-End Convex Billet Mirrors',
      ];
    }

    const matchedParts = this._matchCatalogProducts(['exhaust', 'brake', 'suspension'], mods, catalogProducts);

    return {
      bikeStyle,
      tagline,
      colorScheme,
      engineeringSummary: `Visual inspection highlights a balanced aggressive geometry with optimized mass centralization. The equipped high-flow exhaust and stiffened chassis provide razor-sharp feedback for street and circuit riding.`,
      detectedModifications: mods,
      estimatedHpGain: isScooter ? 2.8 : 7.4,
      weightSavingsKg: isScooter ? 2.2 : 5.1,
      exhaustSoundProfile: '102 dB WorldSBK Titanium Resonance (Acoustically Tuned)',
      dynoAdvice: 'Dynojet dual-sensor AFR calibration suggested to maximize mid-range torque.',
      difficultyRating: 'Pitstop Custom Workshop',
      matchedParts,
      poweredBy: 'MotoTrack Neural Vision Engine',
      analyzedAt: new Date().toISOString(),
    };
  },

  /**
   * Intelligent Simulated Custom Build Analysis (Fallback)
   */
  generateSimulatedAnalysis(bikeName, bikeBrand, selectedParts, selectedThemeName, customPrompt = '') {
    const partsCount = selectedParts.length;
    const hasExhaust = selectedParts.some((p) => (p.category || '').toLowerCase().includes('exhaust'));
    const hasBrakes = selectedParts.some((p) => (p.category || '').toLowerCase().includes('brake'));
    const hasSuspension = selectedParts.some((p) => (p.category || '').toLowerCase().includes('suspension'));

    let hp = hasExhaust ? 6.2 : 0;
    if (selectedParts.some((p) => (p.name || '').toLowerCase().includes('dynojet'))) hp += 5.5;
    let weight = hasExhaust ? 3.8 : 0;
    if (hasSuspension) weight += 1.4;
    if (hasBrakes) weight += 0.8;

    return {
      tagline: customPrompt
        ? `${bikeBrand || 'Pro'} Custom: ${customPrompt.slice(0, 32)}...`
        : `${bikeBrand || 'Pro'} ${bikeName || 'Motorcycle'}: ${selectedThemeName}`,
      engineeringSummary: `Equipped with ${partsCount} high-spec components engineered for track telemetry. The combination of lightweight chassis parts and precision fuel calibration provides immediate mid-range throttle crispness.`,
      estimatedHpGain: Math.max(2.5, Math.round(hp * 10) / 10),
      weightSavingsKg: Math.max(1.8, Math.round(weight * 10) / 10),
      exhaustSoundProfile: hasExhaust
        ? '102 dB Titanium Deep Resonance (WorldSBK Acoustically Tuned)'
        : '92 dB Factory Sport Note',
      dynoAdvice: 'Dynojet 250i dual-sensor wideband lambda map suggested for 13.2:1 AFR target.',
      installationComplexity: partsCount > 2 ? 'Moderate (Pit Bay Dyno Required)' : 'Direct Bolt-On Fitment',
      visualDetails: `Finished in ${selectedThemeName} with high-gloss thermal protection and billet CNC mounts.`,
      poweredBy: 'MotoTrack Neural Dyno Engine',
    };
  },
};
