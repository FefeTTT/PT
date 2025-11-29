import sys
from pathlib import Path
p = Path(r"c:\xampp\htdocs\PT_Fernando\js\menuTrimestres.js")
if not p.exists():
    print('FILE_NOT_FOUND', p)
    sys.exit(2)
text = p.read_text(encoding='utf-8')

pairs = {')':'(', ']':'[', '}':'{'}
openers = set(pairs.values())
stack = []
line = 1
col = 0
in_single = False
in_double = False
in_back = False
in_regex = False
escape = False
in_comment_line = False
in_comment_block = False

for i, ch in enumerate(text):
    col += 1
    if ch == '\n':
        line += 1
        col = 0
        in_comment_line = False
        escape = False
        continue
    if in_comment_line:
        continue
    # block comment handling
    if in_comment_block:
        # detect end
        if ch == '*' and i+1 < len(text) and text[i+1] == '/':
            in_comment_block = False
            # consume next char by advancing loop: we'll skip next iteration
            # but since loop increments i automatically, we just skip nothing special
            # set col accordingly will be handled on next char
        continue
    if not (in_single or in_double or in_back):
        # check start of comments
        if ch == '/' and i+1 < len(text):
            n = text[i+1]
            if n == '/':
                in_comment_line = True
                continue
            if n == '*':
                in_comment_block = True
                continue
    # handle escapes in strings/regex
    if escape:
        escape = False
        continue
    if ch == '\\':
        # set escape only if inside a string
        if in_single or in_double or in_back or in_regex:
            escape = True
            continue
    # detect start of regex literal (naive): slash not followed by / or * and we're not in a string/comment
    if not (in_single or in_double or in_back or in_regex) and ch == '/' and i+1 < len(text):
        n = text[i+1]
        if n != '/' and n != '*':
            in_regex = True
            continue
    if in_regex:
        # end regex on unescaped slash
        if ch == '/':
            in_regex = False
        continue
    if not (in_single or in_double or in_back):
        if ch == "'":
            in_single = True
            continue
        if ch == '"':
            in_double = True
            continue
        if ch == '`':
            in_back = True
            continue
    else:
        # if in single/double/backtick string, check for closing
        if in_single and ch == "'":
            in_single = False
            continue
        if in_double and ch == '"':
            in_double = False
            continue
        if in_back and ch == '`':
            in_back = False
            continue
        # otherwise skip content of string
        continue
    # at this point we are not inside string or comment
    if ch in openers:
        stack.append((ch, line, col))
    elif ch in pairs:
        if not stack:
            print('UNMATCHED_CLOSER', ch, 'at', line, col)
            sys.exit(3)
        last, lline, lcol = stack.pop()
        if last != pairs[ch]:
            print('MISMATCH', last, 'opened at', lline, lcol, 'but closed by', ch, 'at', line, col)
            print('\nStack at error:')
            for it in stack[-10:]:
                print('  ', it)
            sys.exit(4)

# after loop
if in_single or in_double or in_back:
    print('UNTERMINATED_STRING', 'single' if in_single else ('double' if in_double else 'backtick'), 'at', line, col)
    sys.exit(5)
if in_comment_block:
    print('UNTERMINATED_BLOCK_COMMENT', 'at', line, col)
    sys.exit(6)
if stack:
    last, lline, lcol = stack[-1]
    print('UNMATCHED_OPENER', last, 'opened at', lline, lcol)
    sys.exit(7)
print('OK')
sys.exit(0)
