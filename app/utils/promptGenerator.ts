import { 
  GarmentCategory, 
  UploadedReference, 
  ModelProfile, 
  PoseSetting, 
  BackgroundSetting, 
  GenerationSettings 
} from '../types';
import { GARMENT_CONFIGS } from './constants';

export interface GeneratedPromptBundle {
  masterPrompt: string;
  negativePrompt: string;
  midjourneyPrompt: string;
  fluxPrompt: string;
  sdxlPositivePrompt: string;
  sdxlNegativePrompt: string;
  imagenPrompt: string;
  referenceSummary: string[];
  apiPayloadPreview: Record<string, unknown>;
}

export function buildMasterPrompt(
  category: GarmentCategory,
  references: Record<string, UploadedReference>,
  model: ModelProfile,
  pose: PoseSetting,
  background: BackgroundSetting,
  settings: GenerationSettings
): GeneratedPromptBundle {
  const garmentDef = GARMENT_CONFIGS.find((g) => g.id === category) || GARMENT_CONFIGS[0];

  // 1. Compile Garment References into High-Fidelity Descriptions
  const referenceDescriptions: string[] = [];
  const referenceSummary: string[] = [];
  const imageRefsForPayload: Record<string, unknown>[] = [];

  garmentDef.slots.forEach((slot) => {
    const ref = references[slot.id];
    if (ref && (ref.customNotes || ref.previewUrl || ref.fabricType || ref.colorName)) {
      const parts: string[] = [];
      
      if (ref.colorName) {
        parts.push(`in rich ${ref.colorName}`);
      }
      if (ref.fabricType) {
        parts.push(`crafted from authentic ${ref.fabricType}`);
      }
      if (ref.customNotes) {
        parts.push(`featuring specific design details: "${ref.customNotes}"`);
      } else {
        parts.push(`matching reference ${slot.shortLabel} styling`);
      }

      const slotDesc = `[${slot.name}]: ${parts.join(', ')}`;
      referenceDescriptions.push(slotDesc);
      referenceSummary.push(`${slot.shortLabel}: ${ref.colorName || 'Selected Color'} (${ref.fabricType || 'Custom Fabric'}) ${ref.customNotes ? `- ${ref.customNotes}` : ''}`);

      imageRefsForPayload.push({
        slotId: slot.id,
        slotName: slot.name,
        color: ref.colorName,
        colorHex: ref.colorHex,
        fabric: ref.fabricType,
        designNotes: ref.customNotes,
        hasImageAttached: Boolean(ref.previewUrl),
        weight: ref.aspectImportance === 'strict' ? 1.0 : ref.aspectImportance === 'high' ? 0.85 : 0.7,
      });
    }
  });

  // Default fallback if no references were entered
  const garmentDesignText = referenceDescriptions.length > 0
    ? referenceDescriptions.join('. ')
    : `Luxurious ${garmentDef.name} ensemble in ${garmentDef.defaultFabric}, exquisitely tailored with authentic artisanal embroidery and vibrant true-to-life dye`;

  // 2. Model Persona Details
  const modelText = `A stunning ${model.ageRange || '24-year-old'} ${model.ethnicity}, with ${model.skinTone || 'radiant natural warm skin'}. Hairstyle: ${model.hairStyle}. Makeup: ${model.makeupStyle}. Jewelry & Accessories: ${model.jewelryStyle}. Expression: ${model.expression || 'Serene, confident, high-fashion gaze'}. Natural human skin texture with microscopic pores, fine vellus hairs, subtle subsurface scattering, realistic catchlights in eyes, authentic anatomical proportions, real hands with manicured nails`;

  // 3. Garment Drapery & Realism
  const drapeText = `The ${garmentDef.name} is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, intricate metallic zari thread reflections, and tailored bespoke silhouette. ${garmentDesignText}`;

  // 4. Setting & Lighting
  const environmentText = `Setting: ${background.name} (${background.description}). Lighting: ${background.lightingType}. Atmosphere: ${background.ambiance}`;

  // 5. Camera & Photography Specs
  const cameraText = `Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. ${pose.cameraAngle}. Superb optical sharpness, smooth natural bokeh depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting`;

  // Assemble Master Prompt
  const masterPrompt = `Commercial fashion photoshoot for luxury Indian garments brand. ${modelText}. ${drapeText}. ${environmentText}. ${cameraText}. Masterpiece, ultra-sharp focus, photorealistic 4k resolution, editorial Vogue India / Harpers Bazaar style.`;

  // Standard high-efficiency negative prompt
  const negativePrompt = `bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses`;

  // Midjourney Format
  const arParam = `--ar ${settings.aspectRatio.replace(':', ':')}`;
  const midjourneyPrompt = `${masterPrompt} ${arParam} --v 6.1 --style raw --stylize ${settings.stylizeLevel || 250} --quality 2`;

  // Flux 1.0 Pro Format
  const fluxPrompt = `[Fashion Lookbook 4K]: Professional photograph of a real human model (${model.ethnicity}, ${model.ageRange}) wearing custom ${garmentDef.name}. Details: ${garmentDesignText}. Setting: ${background.name}, ${background.lightingType}. Shot on 85mm lens at f/1.4, lifelike skin pores and fabric thread details, award-winning fashion editorial lighting, crisp 4K UHD.`;

  // SDXL Prompts
  const sdxlPositivePrompt = `(photorealistic 8k commercial photo:1.3), full body shot of ${model.ethnicity} female fashion model wearing bespoke ${garmentDef.name}, ${garmentDesignText}, ${pose.name}, ${background.name}, ${background.lightingType}, Hasselblad H6D, 85mm lens, natural skin texture, masterpiece, highly detailed fabric weave`;
  
  const sdxlNegativePrompt = `(worst quality, low quality:1.4), (deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, plastic skin, cgi, 3d`;

  // Google Imagen 3 Format
  const imagenPrompt = `A high-resolution commercial fashion photograph of a real ${model.ethnicity} model wearing a premium ${garmentDef.name}. The garment features: ${garmentDesignText}. The model is posed in ${pose.name} against ${background.name}. Lighting is ${background.lightingType}. The image has photorealistic skin details, realistic fabric weight and fold dynamics, captured with a professional portrait camera lens.`;

  // API Payload preview
  const apiPayloadPreview = {
    garmentCategory: category,
    resolution: settings.qualityMode,
    aspectRatio: settings.aspectRatio,
    targetModel: model,
    pose: pose.name,
    environment: background.name,
    referenceSlotsAttached: imageRefsForPayload,
    aiEngine: settings.aiEngine,
    enhancements: {
      skinPoresRealism: settings.enhanceSkinTexture,
      fabricWeavePhysics: settings.enhanceFabricWeave,
      lightingPreset: background.lightingType,
    },
    compiledPrompt: masterPrompt,
    negativePrompt: negativePrompt,
  };

  return {
    masterPrompt,
    negativePrompt,
    midjourneyPrompt,
    fluxPrompt,
    sdxlPositivePrompt,
    sdxlNegativePrompt,
    imagenPrompt,
    referenceSummary,
    apiPayloadPreview,
  };
}
