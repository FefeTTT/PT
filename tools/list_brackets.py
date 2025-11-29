from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
text = p.read_text(encoding='utf-8')
for i,line in enumerate(text.splitlines(), start=1):
    if '[' in line or ']' in line:
        print(i, repr(line))
