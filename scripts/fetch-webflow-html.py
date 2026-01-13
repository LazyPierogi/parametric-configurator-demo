#!/usr/bin/env python3
"""
Fetch and extract HTML components from Webflow site.
Run this script to extract header, footer, CSS, and JS from zaslony.com
"""

import urllib.request
import json
import re
from html.parser import HTMLParser

class WebflowExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.css_links = []
        self.font_links = []
        self.js_scripts = []
        self.inline_styles = []
        self.current_section = None
        self.sections = {
            'mini_top': None,
            'navbar': None,
            'footer': None,
            'header': None
        }
        self.section_stack = []
        self.capture_stack = []
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        # Capture CSS links
        if tag == 'link' and attrs_dict.get('rel') == 'stylesheet':
            self.css_links.append(self.get_starttag_text())
            
        # Capture font links
        if tag == 'link' and 'font' in attrs_dict.get('href', '').lower():
            self.font_links.append(self.get_starttag_text())
            
        # Capture JS scripts
        if tag == 'script' and attrs_dict.get('src'):
            self.js_scripts.append(self.get_starttag_text())
            
        # Capture inline styles
        if tag == 'style':
            self.current_section = 'style'
            
        # Check for sections we want to capture
        class_attr = attrs_dict.get('class', '')
        if 'mini-top-section' in class_attr or 'mobile-hide' in class_attr:
            self.capture_stack.append(('mini_top', tag, 1))
        elif 'navbar-section' in class_attr:
            self.capture_stack.append(('navbar', tag, 1))
        elif 'footer-section' in class_attr:
            self.capture_stack.append(('footer', tag, 1))
        elif tag == 'header':
            self.capture_stack.append(('header', tag, 1))
            
        # Track depth for capturing
        if self.capture_stack:
            section_name, section_tag, depth = self.capture_stack[-1]
            if self.sections[section_name] is None:
                self.sections[section_name] = []
            self.sections[section_name].append(self.get_starttag_text())
            
    def handle_endtag(self, tag):
        if self.current_section == 'style' and tag == 'style':
            self.current_section = None
            
        # Handle capture stack
        if self.capture_stack:
            section_name, section_tag, depth = self.capture_stack[-1]
            if tag == section_tag and depth == 1:
                self.sections[section_name].append(f'</{tag}>')
                self.capture_stack.pop()
            else:
                if self.sections[section_name] is not None:
                    self.sections[section_name].append(f'</{tag}>')
                    
    def handle_data(self, data):
        if self.current_section == 'style':
            self.inline_styles.append(data)
            
        if self.capture_stack:
            section_name, _, _ = self.capture_stack[-1]
            if self.sections[section_name] is not None:
                self.sections[section_name].append(data)

def main():
    url = 'https://zaslony.com'
    
    print(f"Fetching HTML from {url}...")
    
    try:
        with urllib.request.urlopen(url) as response:
            html = response.read().decode('utf-8')
            
        # Save complete HTML
        with open('webflow-complete.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print("✓ Saved complete HTML to webflow-complete.html")
        
        # Parse and extract
        extractor = WebflowExtractor()
        extractor.feed(html)
        
        # Compile sections
        sections = {
            'mini_top_section': ''.join(extractor.sections['mini_top']) if extractor.sections['mini_top'] else None,
            'navbar_section': ''.join(extractor.sections['navbar']) if extractor.sections['navbar'] else None,
            'footer_section': ''.join(extractor.sections['footer']) if extractor.sections['footer'] else None,
            'header': ''.join(extractor.sections['header']) if extractor.sections['header'] else None,
        }
        
        # Save extracted sections
        with open('webflow-sections.html', 'w', encoding='utf-8') as f:
            f.write("<!-- MINI TOP SECTION -->\n")
            if sections['mini_top_section']:
                f.write(sections['mini_top_section'])
            f.write("\n\n<!-- NAVBAR SECTION -->\n")
            if sections['navbar_section']:
                f.write(sections['navbar_section'])
            f.write("\n\n<!-- FOOTER SECTION -->\n")
            if sections['footer_section']:
                f.write(sections['footer_section'])
                
        print("✓ Saved extracted sections to webflow-sections.html")
        
        # Create report
        report = {
            'css_links': extractor.css_links,
            'font_links': extractor.font_links,
            'js_scripts': extractor.js_scripts,
            'inline_styles_count': len(extractor.inline_styles),
            'sections_found': {
                'mini_top': sections['mini_top_section'] is not None,
                'navbar': sections['navbar_section'] is not None,
                'footer': sections['footer_section'] is not None,
                'header': sections['header'] is not None,
            }
        }
        
        with open('webflow-extraction-report.json', 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
            
        print("✓ Saved extraction report to webflow-extraction-report.json")
        
        # Print summary
        print("\n" + "="*60)
        print("EXTRACTION SUMMARY")
        print("="*60)
        print(f"CSS Links: {len(extractor.css_links)}")
        print(f"Font Links: {len(extractor.font_links)}")
        print(f"JS Scripts: {len(extractor.js_scripts)}")
        print(f"Inline Styles: {len(extractor.inline_styles)}")
        print(f"\nSections found:")
        for section, found in report['sections_found'].items():
            print(f"  - {section}: {'✓' if found else '✗'}")
            
        # Print CSS links
        if extractor.css_links:
            print("\n" + "="*60)
            print("CSS STYLESHEETS")
            print("="*60)
            for link in extractor.css_links:
                print(link)
                
        # Print font links
        if extractor.font_links:
            print("\n" + "="*60)
            print("FONT IMPORTS")
            print("="*60)
            for link in extractor.font_links:
                print(link)
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
