"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';

interface WebflowLayoutProps {
  children: React.ReactNode;
}

export default function WebflowLayout({ children }: WebflowLayoutProps) {
  const [headerHtml, setHeaderHtml] = useState<string>('');
  const [footerHtml, setFooterHtml] = useState<string>('');
  const [cssUrls, setCssUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the Webflow page and extract header/footer
    async function fetchWebflowLayout() {
      try {
        const sourceOrigin = (process.env.NEXT_PUBLIC_WEBFLOW_ORIGIN ?? '').trim();
        if (!sourceOrigin) {
          setLoading(false);
          return;
        }

        const response = await fetch(sourceOrigin);
        const html = await response.text();
        
        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract header sections
        const miniTopSection = doc.querySelector('.section.mini-top-section.mobile-hide');
        const navbarSection = doc.querySelector('.navbar-section');
        
        const headerContent = `
          ${miniTopSection?.outerHTML || ''}
          ${navbarSection?.outerHTML || ''}
        `;
        
        // Extract footer
        const footerSection = doc.querySelector('.footer-section');
        const footerContent = footerSection?.outerHTML || '';
        
        setHeaderHtml(headerContent);
        setFooterHtml(footerContent);
        
        // Extract all CSS URLs
        const stylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
        const cssHrefs = stylesheets
          .map((link) => link.getAttribute('href'))
          .filter((href): href is string => !!href)
          .map((href) => href.startsWith('http') ? href : `${sourceOrigin}${href}`);
        
        // Extract font URLs
        const fontLinks = Array.from(doc.querySelectorAll('link[href*="fonts.googleapis"]'));
        const fontHrefs = fontLinks
          .map((link) => link.getAttribute('href'))
          .filter((href): href is string => !!href);
        
        setCssUrls([...cssHrefs, ...fontHrefs]);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch Webflow layout:', error);
        setLoading(false);
      }
    }
    
    fetchWebflowLayout();
  }, []);

  return (
    <>
      {/* Inject Webflow CSS dynamically */}
      {cssUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}
      
      {/* Header */}
      {headerHtml && (
        <div 
          dangerouslySetInnerHTML={{ __html: headerHtml }}
          suppressHydrationWarning
        />
      )}
      
      {/* Main content */}
      <main style={{ minHeight: '60vh' }}>
        {children}
      </main>
      
      {/* Footer */}
      {footerHtml && (
        <div 
          dangerouslySetInnerHTML={{ __html: footerHtml }}
          suppressHydrationWarning
        />
      )}
      
      {/* Webflow JavaScript */}
      <Script 
        src="https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js"
        strategy="lazyOnload"
      />
      <Script 
        src="https://assets-global.website-files.com/js/webflow.js"
        strategy="lazyOnload"
      />
    </>
  );
}
