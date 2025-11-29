from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
lines = p.read_text(encoding='utf-8').splitlines(True)
start = 832-1
end = 840
s = ''.join(lines[start:end])
print('---repr---')
print(repr(s))
print('---raw hex---')
print(s.encode('utf-8').hex())
