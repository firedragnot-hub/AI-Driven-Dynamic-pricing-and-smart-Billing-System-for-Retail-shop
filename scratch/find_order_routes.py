import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
for idx, line in enumerate(lines):
    if '@app.route' in line and ('order' in line.lower() or 'checkout' in line.lower()):
        print(f"Line {idx+1}: {line}")
