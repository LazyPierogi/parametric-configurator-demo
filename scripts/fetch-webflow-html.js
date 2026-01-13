const https = require('https');
const fs = require('fs');

const url = 'https://zaslony.com';

https.get(url, (res) => {
  let html = '';

  res.on('data', (chunk) => {
    html += chunk;
  });

  res.on('end', () => {
    // Save complete HTML
    fs.writeFileSync('webflow-complete.html', html);
    
    // Extract CSS links
    const cssLinks = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)]
      .map(match => match[0]);
    
    // Extract font imports
    const fontLinks = [...html.matchAll(/<link[^>]*href=["'][^"']*fonts[^"']*["'][^>]*>/gi)]
      .map(match => match[0]);
    
    // Extract script tags
    const scripts = [...html.matchAll(/<script[^>]*src=["'][^"']*["'][^>]*>/gi)]
      .map(match => match[0]);
    
    // Extract inline styles
    const inlineStyles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
      .map(match => match[0]);
    
    // Extract header sections
    const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
    const miniTopMatch = html.match(/<[^>]*class=["'][^"']*mini-top-section[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i);
    const navbarMatch = html.match(/<[^>]*class=["'][^"']*navbar-section[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i);
    
    // Extract footer
    const footerMatch = html.match(/<[^>]*class=["'][^"']*footer-section[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i);
    
    // Create extraction report
    const report = {
      cssLinks: cssLinks,
      fontLinks: fontLinks,
      scripts: scripts,
      inlineStylesCount: inlineStyles.length,
      hasHeader: !!headerMatch,
      hasMiniTop: !!miniTopMatch,
      hasNavbar: !!navbarMatch,
      hasFooter: !!footerMatch
    };
    
    fs.writeFileSync('webflow-extraction-report.json', JSON.stringify(report, null, 2));
    
    // Extract specific sections
    const sections = {
      header: headerMatch ? headerMatch[0] : null,
      miniTop: miniTopMatch ? miniTopMatch[0] : null,
      navbar: navbarMatch ? navbarMatch[0] : null,
      footer: footerMatch ? footerMatch[0] : null,
      inlineStyles: inlineStyles
    };
    
    fs.writeFileSync('webflow-sections.json', JSON.stringify(sections, null, 2));
    
    console.log('Extraction complete!');
    console.log('Files created:');
    console.log('- webflow-complete.html (full HTML)');
    console.log('- webflow-extraction-report.json (summary)');
    console.log('- webflow-sections.json (extracted sections)');
    console.log('\nCSS Links found:', cssLinks.length);
    console.log('Font Links found:', fontLinks.length);
    console.log('Scripts found:', scripts.length);
    console.log('Inline styles found:', inlineStyles.length);
  });

}).on('error', (err) => {
  console.error('Error:', err.message);
});
