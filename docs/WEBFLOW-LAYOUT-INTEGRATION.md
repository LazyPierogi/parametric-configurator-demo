# Webflow Layout Integration

## Overview
Static header and footer replicating the design from https://zaslony.com integrated into the Curtain Wizard estimate and configure pages.

## Implementation

### 1. WebflowLayoutStatic Component
**Location:** `apps/web/components/WebflowLayoutStatic.tsx`

**Features:**
- Static header with mini top section (desktop only) showing contact info
- Main navigation bar with logo and menu links
- Comprehensive footer with:
  - About section
  - Navigation menu
  - Curtain categories
  - Newsletter signup form
  - Social media links
  - Contact information
  - Call-to-action button
- Responsive design (mobile-friendly)
- Inline styles for immediate rendering
- No external dependencies or API calls

**Structure:**
```tsx
<WebflowLayoutStatic>
  {children}
</WebflowLayoutStatic>
```

### 2. Page Integration

**Estimate Page:** `apps/web/app/estimate/page.tsx`
- Wrapped entire page content with `<WebflowLayoutStatic>`
- Import: `import WebflowLayoutStatic from '@/components/WebflowLayoutStatic';`

**Configure Pages:** 
- `apps/web/app/configure/LegacyConfigurePage.tsx` - Wrapped with `<WebflowLayoutStatic>`
- `apps/web/app/configure/CurtainFirstConfigurePage.tsx` - Automatically inherits layout via LegacyConfigurePage
- Import: `import WebflowLayoutStatic from '@/components/WebflowLayoutStatic';`

### 3. Styling

**Inline Styles:**
- All styles are inline for maximum portability
- Uses modern CSS (flexbox, grid)
- Responsive breakpoints via JSX style tag

**Fonts:**
- Google Fonts (Inter) loaded via `<link>` tag
- Fallback to system fonts if unavailable

**Colors:**
- Header: White background (#fff)
- Mini top: Light gray (#f7f7f7)
- Footer: Dark (#1a1a1a)
- Accent: White buttons on dark background

### 4. Layout Sections

**Mini Top Section** (Desktop only)
- Contact email: hello@example.com
- Availability message
- Social media links (Instagram, Facebook)

**Main Navigation**
- Sticky positioning
- Logo: "Zaslony.com"
- Menu: Home, O nas, Kolekcje, Blog, Kontakt
- All links point to https://zaslony.com

**Footer**
- 4-column grid (responsive)
- About section with description
- Navigation menu
- Curtain categories (Blackout, Heavy, Light)
- Newsletter signup form
- Social links
- Copyright and contact info
- CTA: "Zrób zdjęcie, my zajmiemy się resztą"

## Usage

The WebflowLayoutStatic component is automatically applied to:
- `/estimate` - Photo upload and measurement page
- `/configure` - Curtain configuration page (both legacy and new flows)

No configuration needed. The layout is rendered immediately with no fetch delays.

## Technical Notes

### No CORS Issues
- Completely static implementation
- No API calls or dynamic fetching
- All content is hardcoded in the component

### Performance
- Instant render (no loading states)
- No network requests for layout
- Minimal CSS overhead (inline styles)
- Google Fonts loaded asynchronously

### Responsive Design
- Mobile: Hides mini top section, collapses navigation
- Desktop: Full layout with all sections
- Breakpoint: 768px (typical tablet/mobile)

### Maintenance
To update content:
1. Edit `apps/web/components/WebflowLayoutStatic.tsx`
2. Change text, links, or styling directly in JSX
3. No build process required

### Future Improvements
1. ✅ Extract styles to CSS modules for better maintainability
2. ✅ Add mobile hamburger menu
3. ✅ Extract navigation links to configuration
4. ✅ Add hover states and transitions
5. ✅ Integrate with i18n for multi-language support

## Testing Checklist

- [x] Header appears on /estimate
- [x] Footer appears on /estimate  
- [x] Header appears on /configure (legacy flow)
- [x] Footer appears on /configure (legacy flow)
- [x] Header appears on /configure (new flow)
- [x] Footer appears on /configure (new flow)
- [ ] Navigation links work correctly
- [ ] Newsletter form submission works
- [ ] Mobile responsive layout displays correctly
- [ ] Mini top section hidden on mobile
- [ ] Footer columns stack properly on mobile
- [ ] Social links open in new tabs

## Customization

### Update Links
All navigation links currently point to https://zaslony.com. To update:
- Search for `href="https://zaslony.com` in WebflowLayoutStatic.tsx
- Replace with your desired URLs

### Update Contact Info
- Email: Change `hello@example.com`
- Social: Update Instagram/Facebook URLs

### Update Branding
- Logo text: Change "Zaslony.com"
- Colors: Modify inline style backgroundColor values
- Fonts: Update Google Fonts link

## Rollback

To remove the Webflow layout:
1. Remove `<WebflowLayoutStatic>` wrapper from estimate/page.tsx
2. Remove `<WebflowLayoutStatic>` wrapper from LegacyConfigurePage.tsx
3. Remove import statements
4. Delete `apps/web/components/WebflowLayoutStatic.tsx`

## Migration from Dynamic Version

The previous dynamic version (`WebflowLayout.tsx`) fetched HTML via API and had CORS issues. This static version:
- ✅ No CORS problems
- ✅ Faster rendering (no fetch delay)
- ✅ More reliable (no network dependency)
- ✅ Easier to customize
- ⚠️ Requires manual updates for content changes
