const fs = require('fs');
const path = require('path');

const logPath = 'D:\\obsidian\\Antigravity\\10_Projects\\garmets_img\\log.md';
const statePath = 'D:\\obsidian\\Antigravity\\10_Projects\\garmets_img\\STATE.md';

const logEntry = `
## [2026-10-09] Poses Overhaul: Audience-Connected Realism & Optical Mirror Physics
- **Replaced Poses**: Overhauled legacy and mismatched DB poses with 6 curated realistic poses for Saree and 4 for Kurti tailored to RGJ Dass's primary personas ('The Home CEO' and 'The Professional Connoisseur').
- **Optical Mirror Physics Fixed**: Solved the broken mirror physics bug by enforcing over-the-shoulder 45-degree camera perspective, optical ray-tracing reflection geometry, symmetrical limb & jewelry alignment, and specialized mirror negative prompts.
- **Generated Reference Images**: Generated and installed photorealistic sample reference images (/poses/saree_pose_mirror.jpg, /poses/saree_pose_front.jpg, etc.) for users to visually select in /admin/generate/[templateId].
- **Reference Inspector Lightbox**: Added interactive 'Inspect Reference Angle' modal allowing users to inspect camera angles, optical physics notes, and textile focus areas before generating.
`;

try {
  if (fs.existsSync(logPath)) {
    fs.appendFileSync(logPath, logEntry, 'utf8');
    console.log('✓ Appended to log.md');
  }
  if (fs.existsSync(statePath)) {
    let state = fs.readFileSync(statePath, 'utf8');
    state = state.replace('## Next Immediate Steps', `## Current Poses Architecture
- Database GarmentTemplate poses updated with 6 Saree and 4 Kurti realistic poses.
- Reference images installed in \`public/poses/\` with ray-traced mirror physics reference (\`saree_pose_mirror.jpg\`).
- UI includes interactive 'Inspect Reference Angle' lightbox modal.
- Backend routes (\`generate\`, \`generate-flux\`) enforce mirror optical geometry rules.

## Next Immediate Steps`);
    fs.writeFileSync(statePath, state, 'utf8');
    console.log('✓ Updated STATE.md');
  }
} catch (e) {
  console.error('Error updating obsidian:', e.message);
}
