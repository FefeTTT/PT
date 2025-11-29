import sys
from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
line_no = int(sys.argv[1]) if len(sys.argv)>1 else 835
lines = p.read_text(encoding='utf-8').splitlines()
if line_no<1 or line_no>len(lines):
    print('OUT_OF_RANGE', line_no)
    sys.exit(2)
line = lines[line_no-1]
print('LINE', line_no, repr(line))
for i,ch in enumerate(line, start=1):
    print(i, ch, ord(ch))
