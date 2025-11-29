from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
text = p.read_text(encoding='utf-8')
lines = text.splitlines(True)
for i in range(min(10,len(lines))):
    print(i+1, repr(lines[i]))
print('---hex of first 120 bytes---')
print(text[:120].encode('utf-8').hex())
