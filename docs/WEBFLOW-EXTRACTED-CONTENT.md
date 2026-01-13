# Webflow Site Structure Extraction

**Source:** https://zaslony.com  
**Extracted:** December 15, 2025

## Important Note

The fetch tool provided rendered content rather than raw HTML with CSS classes. For a complete extraction with exact class names, inline styles, and full HTML structure, you'll need to:

1. Open the URL in a browser
2. Use browser DevTools (Right-click → Inspect)
3. Copy the HTML from the Elements panel
4. Export CSS from the Network tab

## Extracted Content Structure

### Header Sections

Based on your requirements, the site should have:
- `.section.mini-top-section.mobile-hide` - Top banner section
- `.navbar-section` - Main navigation

### Navigation Links Found

- [Home](https://zaslony.com/)
- [O nas](https://zaslony.com/about) (About)
- [Kolekcje](https://zaslony.com/shop) (Collections)
- [Blog](https://zaslony.com/blogs)
- [Kontakt](https://zaslony.com/contact) (Contact)

### Category Links

- [Blackout](https://zaslony.com/category/blackout)
- [Heavy](https://zaslony.com/category/heavy)
- [Light](https://zaslony.com/category/light)

### Main Content Sections

#### 1. Categories Section
**Heading:** "Kategorie zasłon"
**Content:** Links to Blackout, Heavy, and Light categories

#### 2. About Section
**Heading:** "O nas"
**Subheading:** "Najwyższej jakości wyposażenie Twojego domu"
**Description:** "Odkryj starannie wykonane zasłony i firany, które nadadzą Twoim wnętrzom niepowtarzalny styl i wygodę."
**CTAs:**
- [Więcej o nas](https://zaslony.com/about)
- [Napisz do nas](https://zaslony.com/contact)

**Services Subheading:** "Nasze Usługi"
**Service Features:**
- "Jesteśmy dostępni dla Was codziennie"
- "Darmowa dostawa dla zamówień powyżej 1000 zł"
- "Zwroty Reklamacje"

#### 3. Blog Section
**Heading:** "Wszystko o zasłonach"
**CTA:** [Przeczytaj blog](https://zaslony.com/blogs)

**Featured Post:**
- Author: Anna Kowal
- Date: 10.11.2025
- Title: [Jak nowe technologie zmieniają świat projektowania wnętrz](https://zaslony.com/blogs/jak-ai-projektuje-nasz-swiat)
- CTA: [Czytaj](https://zaslony.com/blogs/jak-ai-projektuje-nasz-swiat)

#### 4. Newsletter Section
**Heading:** "Bądźmy w kontakcie"
**CTA:** "Subskrybuj" (with image icon)

### Footer Section (`.footer-section`)

#### Footer Navigation Links
- Home
- [O nas](https://zaslony.com/about)
- [Kolekcje](https://zaslony.com/shop)
- [Blog](https://zaslony.com/blogs)
- [Kontakt](https://zaslony.com/contact)

#### Contact Section
**Heading:** "Masz pytania?"
**CTA:** [Napisz do nas](https://zaslony.com/contact)
**Email:** [hello@example.com](https://example.com/contact)

#### Social Links
- Instagram: [](https://www.instagram.com/)
- Facebook: [](https://www.facebook.com/)

#### Copyright & Credits
- "Copyright 2025 © Zaslony.com" - [Powered by Good People](https://www.flowsleek.com/)
- [Powered by Good People](https://webflow.com/)

#### Bottom CTA
"Zrób zdjęcie, my zajmiemy się resztą" - [Link](https://zaslony.com/contact)

## Assets Needed

### CSS Stylesheets
To extract the exact stylesheet URLs, you need to inspect the `<head>` section for:
```html
<link rel="stylesheet" href="...">
```

Common Webflow CSS patterns:
- Main stylesheet: typically hosted on `assets.website-files.com`
- Normalize/reset CSS
- Custom project CSS

### Font URLs
Look for:
```html
<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
```
or
```css
@import url('https://fonts.googleapis.com/...');
```

### Images
The site uses various images (marked as `[Image: Image]` in extraction) that would need to be:
1. Downloaded from the site
2. Hosted in your React app's public folder
3. Referenced in the component

## Next Steps for Complete Extraction

To get the **complete raw HTML** with all class names:

### Method 1: Browser DevTools
1. Open https://zaslony.com in Chrome/Firefox
2. Right-click → Inspect Element
3. In Elements panel, right-click on `<html>` or specific sections
4. Select "Copy" → "Copy outerHTML"
5. Paste into a text file

### Method 2: View Page Source
1. Open https://zaslony.com
2. Press `Ctrl+U` (Windows) or `Cmd+Option+U` (Mac)
3. Copy the entire source
4. Save to a file

### Method 3: Network Tab for CSS
1. Open DevTools → Network tab
2. Reload the page
3. Filter by "CSS"
4. Click on each CSS file
5. Copy the Response content

### Method 4: Computed Styles
For inline critical CSS:
1. Inspect any element
2. Check "Styles" panel for `<style>` tags in `<head>`
3. Look for inline styles with `style=""` attributes

## React Component Structure

Once you have the HTML, create components like:

```tsx
// components/WebflowHeader.tsx
export const WebflowHeader = () => {
  return (
    <>
      <section className="section mini-top-section mobile-hide">
        {/* Mini top section content */}
      </section>
      
      <section className="navbar-section">
        {/* Navbar content */}
      </section>
    </>
  );
};

// components/WebflowFooter.tsx
export const WebflowFooter = () => {
  return (
    <footer className="footer-section">
      {/* Footer content */}
    </footer>
  );
};
```

## CSS Integration Strategy

### Option 1: Import Webflow CSS Directly
```tsx
// In your main layout or _app.tsx
import 'path/to/webflow-normalize.css';
import 'path/to/webflow-main.css';
```

### Option 2: Copy CSS to Your Project
1. Download all CSS files
2. Place in `public/styles/` or `src/styles/`
3. Import in component or globally

### Option 3: Use CSS Modules
1. Convert Webflow classes to CSS modules
2. Import and apply with `styles.className`

## Fonts Integration

Add to `<head>` in your React app (in `_document.tsx` for Next.js or `index.html` for Vite):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
```

## Data Attributes & IDs

Once you have the raw HTML, look for:
- `id="..."` attributes
- `data-*` attributes (Webflow uses these extensively)
- `aria-*` attributes for accessibility
- `role` attributes

These are crucial for:
- JavaScript interactions
- Animations (Webflow IX2)
- Responsive behavior
- Accessibility

## Known Webflow Patterns

Webflow typically generates:
- Container classes: `.w-container`, `.w-row`, etc.
- Responsive utilities: `.w-hidden-*`, `.w-visible-*`
- Layout classes: `.w-col`, `.w-col-*`
- Interactive elements: `.w-button`, `.w-form`, etc.

## Warning: Dynamic Content

Note that some Webflow features may require:
- JavaScript for animations (Webflow.js)
- Form handling scripts
- Cookie consent scripts
- Analytics scripts

For a truly static React component, you may need to:
1. Remove dynamic behaviors
2. Implement animations with React libraries (Framer Motion, GSAP)
3. Replace forms with your own handlers

---

**Action Required:** Please manually extract the raw HTML using the methods described above, then I can help you convert it into React components with the exact structure and styling.
