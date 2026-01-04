"""
BRDC Template Splitter
This script splits templates.html into 8 separate HTML files
"""

import os
import re

def split_templates():
    # Read the templates.html file
    templates_path = os.path.join('public', 'templates.html')
    
    print(f"Reading {templates_path}...")
    
    with open(templates_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Define the files we're looking for
    template_files = [
        'bracket.html',
        'register.html',
        'tournament.html',
        'event.html',
        'league.html',
        'standings.html',
        'schedule.html',
        'live-match.html'
    ]
    
    # Split by HTML comment markers
    sections = re.split(r'<!-- (.*?) -->', content)
    
    # Process sections
    current_file = None
    current_content = []
    
    for i, section in enumerate(sections):
        # Check if this is a filename marker
        if section.strip() in template_files:
            # Save previous file if exists
            if current_file and current_content:
                output_path = os.path.join('public', current_file)
                file_content = ''.join(current_content).strip()
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(file_content)
                
                print(f"✓ Created {current_file}")
            
            # Start new file
            current_file = section.strip()
            current_content = []
        else:
            # Add content to current file
            if current_file:
                current_content.append(section)
    
    # Save the last file
    if current_file and current_content:
        output_path = os.path.join('public', current_file)
        file_content = ''.join(current_content).strip()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(file_content)
        
        print(f"✓ Created {current_file}")
    
    print("\n✅ All done! 8 files created successfully!")
    print("\nYou can now delete templates.html if you want.")

if __name__ == '__main__':
    print("=" * 50)
    print("BRDC Template Splitter")
    print("=" * 50)
    print()
    
    # Check if we're in the right directory
    if not os.path.exists('public'):
        print("❌ Error: Can't find 'public' folder!")
        print("Make sure you're running this from C:\\Users\\gcfrp\\brdc-firebase\\")
        input("\nPress Enter to exit...")
        exit(1)
    
    if not os.path.exists(os.path.join('public', 'templates.html')):
        print("❌ Error: Can't find templates.html in the public folder!")
        input("\nPress Enter to exit...")
        exit(1)
    
    # Run the splitter
    split_templates()
    
    print("\nPress Enter to exit...")
    input()
