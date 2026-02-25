import re
import os

filepath = r'c:\Users\jafet\OneDrive\Escritorio\Uni\CB\PT\modelo\ProfesorDAO.php'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace in SELECTs
content = re.sub(r'gradoEstudios,\s*', '', content)
content = re.sub(r'p.gradoEstudios,\s*', '', content)

# Replace in row access
content = re.sub(r"\$row\['gradoEstudios'\]", "null", content)

# Replace in INSERT
content = re.sub(r'INSERT INTO profesor \((.*?)gradoEstudios,\s*(.*?)\)\s*VALUES\s*\((.*?)\?,\s*(.*?)\)', r'INSERT INTO profesor (\1\2) VALUES (\3\4)', content)

# Replace in UPDATE
content = re.sub(r'gradoEstudios\s*=\s*\?,\s*', '', content)

# Replace vo->getGradoEstudios() in execute arrays
content = re.sub(r'\$vo->getGradoEstudios\(\),\s*', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
