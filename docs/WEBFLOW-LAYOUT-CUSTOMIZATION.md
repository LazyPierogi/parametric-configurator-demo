# Webflow Layout Customization Guide

## Quick Reference

The static Webflow layout is located in:
```
apps/web/components/WebflowLayoutStatic.tsx
```

## Common Customizations

### 1. Update Navigation Links

Find the navigation menu section (around line 60):
```tsx
<div className="navbar-menu">
  <a href="https://zaslony.com/">Home</a>
  <a href="https://zaslony.com/about">O nas</a>
  <a href="https://zaslony.com/shop">Kolekcje</a>
  <a href="https://zaslony.com/blogs">Blog</a>
  <a href="https://zaslony.com/contact">Kontakt</a>
</div>
```

Replace with your URLs:
```tsx
<div className="navbar-menu">
  <a href="/">Home</a>
  <a href="/about">O nas</a>
  <a href="/shop">Kolekcje</a>
  <a href="/blog">Blog</a>
  <a href="/contact">Kontakt</a>
</div>
```

### 2. Change Logo

Find the logo section (around line 45):
```tsx
<a href="https://zaslony.com" style={{ 
  fontSize: '24px', 
  fontWeight: 700,
  color: '#000',
  textDecoration: 'none'
}}>
  Zaslony.com
</a>
```

Replace with your logo or image:
```tsx
<a href="/">
  <img src="/logo.svg" alt="Your Brand" height={40} />
</a>
```

### 3. Update Contact Information

Find the mini top section (around line 15) and footer contact (around line 200):
```tsx
<span>✉️ hello@example.com</span>
```

Replace with your email:
```tsx
<span>✉️ your-email@domain.com</span>
```

### 4. Update Social Media Links

Find social links in both header and footer:
```tsx
<a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">
  Instagram
</a>
<a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer">
  Facebook
</a>
```

Replace with your social media URLs.

### 5. Change Colors

**Header Background:**
```tsx
backgroundColor: '#fff'  // White
```

**Footer Background:**
```tsx
backgroundColor: '#1a1a1a'  // Dark gray
```

**Mini Top Section:**
```tsx
backgroundColor: '#f7f7f7'  // Light gray
```

### 6. Newsletter Form Integration

Find the newsletter form (around line 160):
```tsx
<form style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
  <input type="email" placeholder="Twój email" />
  <button type="submit">Subskrybuj</button>
</form>
```

Add form handler:
```tsx
<form onSubmit={(e) => {
  e.preventDefault();
  // Your newsletter signup logic
}} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
  <input 
    type="email" 
    placeholder="Twój email"
    required
  />
  <button type="submit">Subskrybuj</button>
</form>
```

### 7. Update Category Links

Find categories section (around line 145):
```tsx
<a href="https://zaslony.com/category/blackout">Blackout</a>
<a href="https://zaslony.com/category/heavy">Heavy</a>
<a href="https://zaslony.com/category/light">Light</a>
```

Replace with your product categories.

### 8. Change Footer CTA Button

Find the CTA button (around line 210):
```tsx
<a 
  href="https://zaslony.com/contact"
  style={{
    display: 'inline-block',
    padding: '15px 40px',
    backgroundColor: '#fff',
    color: '#000',
    fontSize: '16px',
    fontWeight: 600,
    textDecoration: 'none',
    borderRadius: '4px'
  }}
>
  Zrób zdjęcie, my zajmiemy się resztą
</a>
```

Update text and link as needed.

## Extract to CSS Modules (Optional)

To make styling more maintainable, create a CSS module:

**Create:** `apps/web/components/WebflowLayoutStatic.module.css`
```css
.miniTopSection {
  background-color: #f7f7f7;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}

.navbar {
  background-color: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 20px 0;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.footer {
  background-color: #1a1a1a;
  color: #fff;
  padding: 60px 0 20px;
}
```

**Import and use:**
```tsx
import styles from './WebflowLayoutStatic.module.css';

<div className={styles.navbar}>
  {/* content */}
</div>
```

## Mobile Menu (Future Enhancement)

To add a mobile hamburger menu, you'll need to:

1. Add state for menu open/closed
2. Add hamburger icon (☰)
3. Add conditional rendering for mobile menu
4. Add click handler to toggle menu

Example:
```tsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// In navbar section:
<button 
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  className="mobile-menu-toggle"
>
  ☰
</button>

{mobileMenuOpen && (
  <div className="mobile-menu">
    {/* Navigation links */}
  </div>
)}
```

## i18n Integration (Future Enhancement)

To support multiple languages:

1. Extract all text strings to translation files
2. Use the `useLocale()` hook
3. Replace hardcoded text with `t('key')`

Example:
```tsx
const { t } = useLocale();

<h3>{t('footer.aboutTitle')}</h3>
<p>{t('footer.aboutDescription')}</p>
```

## Testing Changes

After making changes:

1. Start dev server: `npm run dev`
2. Visit `/estimate` and `/configure`
3. Check both desktop and mobile viewports
4. Verify all links work correctly
5. Test newsletter form submission
6. Check responsive breakpoints (resize browser)

## Common Issues

**Layout not appearing:**
- Check import statement in page files
- Verify component is properly wrapped around content

**Styles conflicting:**
- Use more specific selectors
- Add `!important` if needed
- Check CSS specificity

**Links not working:**
- Verify href attributes
- Check for typos in URLs
- Ensure Next.js Link component if using internal routes

**Mobile not responsive:**
- Check media query breakpoint (768px)
- Verify `mobile-hide` class is applied
- Test in actual mobile devices, not just browser resize
