# CoutureAI Studio (`garmets_img`)

**CoutureAI Studio** is a Next.js full-stack platform for luxury Indian ethnic-wear catalogue photography, inventory management, and omni-channel commerce sync. It turns flat garment / fabric swatch photos into studio-grade multi-pose model photoshoots while managing SKUs, categories, pricing, wholesale collages, AI captions, and Picky Assist / WhatsApp / Shopify / PACT integrations.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Database & ORM**: PostgreSQL + Prisma (`@prisma/client`)
- **Authentication**: NextAuth v5 (`next-auth`) with Google OAuth & Admin role guards (`lib/auth.ts`)
- **AI Image Generation & Vision**:
  - **Kie.ai Task API** (`Seedream 5 Pro / Flash / Lite`, `Nano Banana 2.1`, `Flux`, `GPT Image`) via `lib/kie-adapter.ts`
  - **Google Gemini Vision & Copy** (`@google/genai`, `gemini-3-6-flash` via Kie.ai or direct `GEMINI_API_KEY`)
  - **Local Computer Vision**: `sharp` pixel/cell motif & color-cluster analyzer (`lib/swatchAnalyzer.ts`)
- **Media Storage**: Cloudflare R2 (`@aws-sdk/client-s3`) with Cloudinary & ImgBB fallbacks (`lib/storage.ts`)
- **Google Integrations**: Google Drive Picker (`react-google-drive-picker`) & Google Photos Picker (`app/hooks/useGooglePhotosPicker.ts`)
- **Spreadsheets**: Client-side Excel/CSV parsing & SKU size-variant consolidation (`xlsx`, `lib/spreadsheet-mapper.ts`, `lib/size-inventory.ts`)

---

## Project Structure & Key Files

```text
app/
├── admin/
│   ├── page.tsx                      # Admin Studio Dashboard
│   ├── ClientLayout.tsx              # Admin sidebar navigation
│   ├── inventory/                    # Product list, filters, inline qty/category edits, Excel import, Picky sync
│   ├── categories/                   # Garment categories & sub-categories
│   ├── templates/                    # Code-managed template listing & read-only inspector ([id]/page.tsx)
│   ├── model-selection/              # Kie.ai image engine management & StudioConfig defaults
│   ├── models/                       # AI Model Personas (Priyanka, Anjali, Sana, Navya, custom)
│   ├── generate/                     # Template picker & AI Photoshoot Studio ([templateId]/page.tsx)
│   ├── admins/                       # Admin user access management
│   └── picky-test/                   # Picky Assist webhook & search tester
├── api/
│   ├── generate/route.ts             # Core AI photoshoot prompt builder & Kie.ai task submission
│   ├── generate-garment-ref/route.ts # Stage 1 virtual garment reference (flat-lay / dress-form)
│   ├── analyze-swatch/route.ts       # Textile swatch & pallu tassel/hem vision analyzer
│   ├── task-status/route.ts          # Async Kie.ai job poller + R2 upload + Product DB sync
│   ├── generate-caption/route.ts     # WhatsApp / Instagram / Website AI copy generation
│   ├── admin/                        # Products, categories, templates, models, kie-models, Picky sync
│   ├── google/photos/                # Google Photos session, download & album export
│   └── v1/                           # WhatsApp catalog, sync & PACT/Shopify/Picky Assist webhooks
├── components/
│   ├── PointCropperModal.tsx         # 4-point affine perspective cropper for swatches
│   ├── SwatchAnalysisModal.tsx       # Visual motif, pattern density & debug inspector modal
│   ├── CollageCreator.tsx            # Multi-layout wholesale catalogue collage & SKU sheet builder
│   └── ...
└── utils/
    ├── modelsAndPoses.ts             # Consistent Model Personas & fixed Saree/Kurti pose recipes
    └── sareePromptBuilder.ts         # Structured Saree prompt compiler, image manifest & exclusions

lib/
├── hardcoded-templates.ts            # Single source of truth for hardcoded Saree & Kurti templates (slots, options, poses, prompts)
├── kie-adapter.ts                    # Multi-model Kie.ai payload adapter
├── swatchAnalyzer.ts                 # Local Sharp CV motif/color cluster analyzer
├── storage.ts                        # R2 / Cloudinary / ImgBB asset persistence
├── picky-assist-push.ts              # Picky Assist catalog search-before-create & diff sync
├── spreadsheet-mapper.ts             # Smart Excel header detection & garment field mapping
└── size-inventory.ts                 # Size-variant row consolidation

prisma/
└── schema.prisma                     # Product, Category, GarmentTemplate, AIModel, CustomerOrder, etc.
```

---

## How AI Image Generation Works

The AI Photoshoot Studio (`app/admin/generate/[templateId]/page.tsx`) and its backend (`app/api/generate/route.ts`) are built around **garment-specific architecture** rather than generic prompts. Every upload, scan, crop, and prompt section is structured to keep fabric weave, border geometry, motif scale, and model identity faithful across all poses.

### 1. Hardcoded Templates, Slots & Garment Logic (`lib/hardcoded-templates.ts`)
- **Single Source of Truth (`lib/hardcoded-templates.ts`)**:
  - Garment templates (`saree` with legacy ID alias `cmuylgqoe0000eqk4chkv3hi9`, and `kurti`) are **hardcoded in `lib/hardcoded-templates.ts`** — creating, editing structure, or deleting templates in the Admin Panel is disabled (`POST` / `DELETE` return `403`, `/admin/templates/new` redirects to `/admin/templates`, and `/admin/templates/[id]` is a read-only inspector).
  - Each hardcoded template defines canonical upload slot IDs (`body`, `pallu`, `blouse` for Saree; `kurti_front`, `bottom_pant`, `dupatta` for Kurti), `customOptions`, `systemPrompt`, `cameraSettings`, `negativePrompt`, and `poses`.
  - To ensure `CustomerOrder` database foreign keys remain valid, `listMergedHardcodedTemplates()` and `resolveOrEnsureTemplateDbId()` automatically sync/resolve the hardcoded slugs in PostgreSQL while allowing only `isActive` and `allowModelSelection` toggles from the Admin UI.
- **Hardcoded Pose & Persona Registry (`app/utils/modelsAndPoses.ts`)**:
  - `CONSISTENT_MODELS`: Defines canonical persona identity anchors (`Priyanka`, `Anjali`, `Sana`, `Navya`).
  - `CATEGORY_POSES_MAP`: Defines the 6 fixed Saree poses and 4 Kurti poses with exact camera framing and posture snippets.
- **Deterministic Slot Injection (`activeImageSlots` in `app/admin/generate/[templateId]/page.tsx`)**:
  - When the active template is a Saree (`template.slug` includes `'saree'`), selecting Saree Layout Modes or Border Modes automatically adapts the body slot description and injects specialized upload slots (`macro_motif`, `upper_border`, `pleat_art`, `border_ribbon`).
  - Because `app/utils/sareePromptBuilder.ts` and `activeImageSlots` rely on canonical slot IDs (`body`, `pallu`, `blouse`, `macro_motif`, `upper_border`, `pleat_art`, `border_ribbon`), all template edits should be made directly in `lib/hardcoded-templates.ts` and `app/utils/modelsAndPoses.ts`.

---

### 2. Saree Layout Modes (`sareeDesignType`)

1. **Default (Symmetric)**
   - Standard repeating motifs across body, pleats, and chest wrap with matching borders.
2. **Delicate Buttis & Embroidered Flowers (`delicate_buttis`)**
   - Unlocks the **`🌸 Micro-Motif / Butti Close-Up (Macro Zoom)`** slot (`macro_motif`).
   - Enforces **true miniature scale** (`~1.2 cm – 1.5 cm`) and **wide airy negative spacing** (`10x–15x` motif size, `~15–20 cm` apart) so the model does not blow up small buttis into oversized prints on the chest drape.
   - Activates the **Delicate Buttis Swatch Vision Scanner** (`POST /api/analyze-swatch`).
3. **Complex Saree / Dual-Tier Pleats (`dual_tier_pleats`)**
   - Unlocks **`Lower Skirt & Pleat Art`** (`pleat_art`, restricted to bottom 15–20% height from feet to knees) and **`Border Ribbon / Edge`** (`border_ribbon`).
   - Defaults Border Selection to **Different Borders**.

---

### 3. Border Architecture Modes (`borderStyle`)

Compiled in `app/utils/sareePromptBuilder.ts` (`effectiveBorderMode`) so **exactly one** mutually exclusive border rule block is sent to the model:

| Mode | Behaviour |
| :--- | :--- |
| **`symmetric`** | Identical reference border along the lower skirt hem, diagonal chest drape, and outer pallu edge. |
| **`different_borders`** / **`dual_contrasting_borders`** | Unlocks `upper_border`. Lower hem uses `body`/`pleat_art` border; diagonal chest drape strictly uses `upper_border` without swapping. |
| **`lower_border_only`** | Authentic wide reference border runs **only** on the bottom skirt hem and outer cascading pallu. The diagonal chest wrap has a neat narrow piping/edge ribbon (`~0.5–1 cm`), and repeating buttis/patterns continue seamlessly up to the ribbon with zero blank margins. |
| **`lower_border_borderless`** | Same bottom hem + outer pallu border, but the diagonal chest wrap is **100% borderless self-fabric** — repeating buttis/patterns extend cleanly all the way to the folded neckline edge with zero blank dead bands. |

---

### 4. Automated Swatch & Pallu Hem Vision Analysis (`POST /api/analyze-swatch`)

1. **Body / Micro-Motif Swatch Scanner (`swatchAnalysis`)**:
   - **Providers**: Supports **Kie.ai (`gemini-3-6-flash`)** or direct **Google Gemini (`GEMINI_API_KEY`)**, with a local **Sharp** computer-vision fallback (`analyzeSwatchBuffer` in `lib/swatchAnalyzer.ts`) that clusters foreground motif pixels against the central fabric background color.
   - **Extracts**:
     - `craft_technique` (e.g., Banarasi brocade, Ajrakh block print, Chikankari, Bandhani, Handloom)
     - `fabric_background` (`base_color`, `texture_notes`)
     - `pattern_type` & `spatial_density` across 10 textile classes: `dense_jaal`, `sparse_buttis`, `medium_repeat`, `stripes_or_leheriya`, `geometric_checks`, `bandhani_dots`, `traditional_narrative`, `floral_vines_bel`, `border_and_plain`, `abstract_modern`
     - `body_motifs` vs `border_elements` separation (prevents border bands from being mistaken for body buttis)
   - **Dynamic Prompt Injection**: `buildSareePrompt` injects the detected motif descriptions and density rules dynamically instead of hardcoding motif names, eliminating motif hallucinations.
   - Inspect results or errors anytime via **`SwatchAnalysisModal`** (`View Output` / `View Error`).

2. **Automatic Pallu Hem & Tassel Detection (`slotType: 'pallu'`)**:
   - Triggered automatically when a `pallu` image is uploaded (or via `Re-check`).
   - Inspects the bottom cross-cut edge for physical dangling tassels, tied kuchu, pom-poms, or latkans (`has_tassels: true/false`).
   - If `has_tassels` is `false`, `buildSareePrompt` enforces **`FLAT TAILORED HEMLINE`** and adds aggressive negative exclusions (`tassels, fringe, hanging strings, kuchu, latkans`) so the AI never hallucinates tassels.

---

### 5. Client-Side Image Preparation & Cloud Import

Before images reach `/api/generate`, each upload slot provides:
- **Client Compression** (`lib/client-compress.ts`): Resizes up to `2560px` JPEG (`~3.8 MB` cap) to avoid server payload limits.
- **90° CW / CCW Canvas Rotation**: Fixes sideways phone photos so borders and pallus are upright.
- **4-Point Precision Perspective Cropper** (`app/components/PointCropperModal.tsx`): Uses an exact triangle affine solver (`solveAffine` + `renderPerspectiveQuad`) to unwarp skewed saree swatches, remove floor/bedsheet backgrounds, or zoom cleanly onto a single butti.
- **Google Drive & Google Photos Pickers**: Import raw fabric photos directly from Drive or Google Photos albums.

---

### 6. Optional Stage 1: Virtual Garment Reference (`POST /api/generate-garment-ref`)

- Generates a **product-only** reference photo (`laid_flat` or headless `dress_form`, `front` or `rear`) using `nano-banana-2-1` before running human model poses.
- Controlled by structured attributes: `sareeFabricType`, `palluSize`, `borderWidth`, `borderEdges`, `tassels` / `tasselColor`, `blouseRule` (`match_swatch`, `plain_contrast`, `same_as_body`), and section descriptions.

---

### 7. Model Personas, Backgrounds & Pose-to-Pose Continuity

- **Model Identity Lock**: Selected `AIModel` (or `CONSISTENT_MODELS`) supplies both a `promptAnchor` text description and a `modelFaceUrl` reference image placed strictly *after* fabric swatches in the image manifest.
- **Backgrounds & ICP Styling**:
  - Occasion presets (`Onam / festival`, `Kitty party`, `Parent-teacher meet`, `Small get-together`, `Workday`) and Fabric fallbacks (`Linen / light cotton`, `Everyday cotton / ajrakh / print`, `Tussar / silk / premium`, `Kurti set (any)`).
  - ICP rules (`home_ceo` vs `professional`) adjust expression, hand props, jewellery, and daylight mood.
- **Canonical Image Manifest (`buildSareePrompt`)**:
  - Orders images deterministically (`1..N` with zero gaps): `body` → `pallu` → `upper_border` → `macro_motif` → `pleat_art` → `border_ribbon` → `blouse` → `model_face` → optional `pose_preview`.
- **Saree Drape & Optical Mirror Physics**:
  - Enforces a **continuous unbroken 6-yard saree drape** (chest wrap → shoulder pleats → over shoulder crest → cascading pallu) and a **100% locked tailored blouse** across every pose (no sleeveless or mismatched tops).
  - **Pose 1 (`1. The Mirror Moment`)**: Activates optical ray-tracing mirror rules so the face and chest wrap inside the mirror reflection match `The Classic Front Stand` 1:1 while the foreground displays the cascading pallu.
  - **Non-Saree / Kurti Pipeline**: Switches to tailored kurti silhouette rules (`kurta`, `neckline/placket`, `sleeves & slits`, `bottom pant`, `dupatta`) with strict no-saree exclusions.

---

### 8. Multi-Model Kie.ai Adapter, Polling & Post-Generation Tools

1. **Universal Payload Adapter (`lib/kie-adapter.ts`)**:
   - Normalizes request payloads for any admin-configured model in `/admin/model-selection`:
     - **Seedream / Seedance** (`quality: 'basic' | 'high'`, `size: '1K' | '2K'`, `image_urls`, negative exclusions appended to prompt)
     - **Nano Banana 2.1** (`image_input` + `image_urls`, `resolution: '2K'`, negative exclusions appended to prompt)
     - **Flux** (`input_urls` + `image_urls`, negative exclusions appended to prompt)
     - **GPT Image / Generic** (`input_urls`, `negative_prompt`)
2. **Async Task Polling & Persistence (`GET /api/task-status`)**:
   - `/api/generate` submits tasks with `async: true` so multiple poses run concurrently without timing out.
   - `/api/task-status` polls `https://api.kie.ai/api/v1/jobs/recordInfo`, uploads completed outputs to permanent storage (`R2` / `Cloudinary` via `lib/storage.ts`), and writes `generatedImages` + `coverImageUrl` back to the `Product` record.
3. **Regenerate with Suggestions**:
   - Any individual pose can be regenerated with targeted `promptSuggestions` (e.g., border width, blouse neckline, lighting fixes) applied directly to the prompt builder.
4. **Wholesale Collage Creator & AI Copy**:
   - **`CollageCreator`** (`app/components/CollageCreator.tsx`): Combines generated poses and swatches into multi-card wholesale catalog sheets with SKU tags and export options.
   - **AI Captions** (`POST /api/generate-caption`): Generates WhatsApp, Instagram, and Website product copy via Gemini.
   - **Google Photos Export** (`POST /api/google/photos/export-album`): Exports finished pose sets directly to a Google Photos album.

---

## Inventory, Categories & Commerce Integrations

- **Inventory Management (`app/admin/inventory/page.tsx`, `app/api/admin/products/route.ts`)**:
  - Global DB stats (Total, In Stock, Out of Stock, Low Stock `<= 3`, Categorized/Uncategorized, Picky Sync states).
  - Filters by Garment Type, Sub-Category, Status/Stock Health, Picky Assist Sync State, Catalog Readiness (missing image/price/AI), Cloth Type, Color, Sorting, and URL-persisted pagination.
  - Client-side **Excel/CSV Batch Import** (`lib/spreadsheet-mapper.ts`, `lib/size-inventory.ts`) consolidating multi-size rows by `code1` / `stockCode`.
- **Picky Assist Sync (`lib/picky-assist-push.ts`, `app/api/admin/picky-assist/sync/route.ts`)**:
  - Search-before-create workflow (`searchPickyProduct` → `syncPickyProductWithDiff` → `addPickyProduct` / `updatePickyProduct`) with Smart Sync queue modal (pause/resume/stop + live activity log).
- **Webhooks & External APIs (`app/api/v1/`)**:
  - WhatsApp Catalog (`/api/v1/whatsapp-catalog`), WhatsApp Orders webhook, Shopify webhook, PACT ERP sync/webhook, and Picky Assist product/order webhooks.

---

## Environment Variables

Configure `.env.local` with the required keys for the features you use:

- **Database & Auth**: `DATABASE_URL`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- **AI Generation & Vision**: `KIE_API_KEY` (or `PIAPI_API_KEY`), `KIE_DEFAULT_MODEL`, `GEMINI_API_KEY`, `SEGMIND_API_KEY`
- **Media Storage**:
  - Cloudflare R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_IMAGES_BUCKET`, `R2_MODELS_BUCKET`, `R2_GENERATED_BUCKET`, `R2_PUBLIC_URL`, `R2_IMAGES_PUBLIC_URL`, `R2_MODELS_PUBLIC_URL`, `R2_GENERATED_PUBLIC_URL`
  - Fallbacks: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `IMGBB_API_KEY`
- **Google Drive / Photos Picker (Client)**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`
- **Picky Assist / WhatsApp / ERP**: `PICKY_ASSIST_API_TOKEN`, `PICKY_ASSIST_WEBHOOK_SECRET`, `PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL`, `PICKY_ASSIST_SEARCH_CALLBACK_URL`, `PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL`, `PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `PACT_API_URL`, `PACT_API_TOKEN`, `PACT_WEBHOOK_SECRET`, `SHOPIFY_WEBHOOK_SECRET`, `SYNC_API_KEY`

---

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or `/admin` for the Admin Portal).
