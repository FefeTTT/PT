from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
text = p.read_text(encoding='utf-8')
orig = text
repls = [
    (')\r\n;', ');'),
    (')\n;', ');'),
    ('+\r\n)', '+)'),
    ('+\n)', '+)'),
    (']\r\n);', ']);'),
    (']\n);', ']);')
]
for a,b in repls:
    if a in text:
        text = text.replace(a,b)

if text == orig:
    print('No changes')
else:
    p.write_text(text, encoding='utf-8')
    print('Applied changes')
