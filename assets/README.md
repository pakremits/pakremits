# Source artwork

Originals that are not served as they are. The site ships sized copies from
`public/`, generated from these:

- `pakrimits-mascot.png` (762×1661) → `public/pakrimits-mascot-480.webp` and
  `-960.webp`, the corridor hero's mascot at 1× and 2× of its 480px height:

  ```bash
  node -e "const s=require('sharp');for(const h of [480,960])s('assets/pakrimits-mascot.png').resize({height:h}).webp({quality:82,alphaQuality:90,effort:6}).toFile('public/pakrimits-mascot-'+h+'.webp')"
  ```
