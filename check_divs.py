import sys
import re

def find_unclosed_divs(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Remove comments and strings but preserve newlines
    content = re.sub(r'\{/\*.*?\*/\}', lambda m: '\n' * m.group(0).count('\n'), content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'".*?"', '""', content)
    content = re.sub(r"'.*?'", "''", content)
    content = re.sub(r'`.*?`', lambda m: '\n' * m.group(0).count('\n'), content, flags=re.DOTALL)

    stack = []
    tags = re.finditer(r'<(/?div)\b([^>]*?)(/?)>', content)
    
    for match in tags:
        tag_type = match.group(1)
        is_self_closing = match.group(3) == '/'
        line_num = content.count('\n', 0, match.start()) + 1
        
        if tag_type == 'div':
            if is_self_closing:
                continue
            stack.append(('div', line_num))
        elif tag_type == '/div':
            if not stack:
                print(f"Extra </div> at line {line_num}")
            else:
                stack.pop()

    for tag, line_num in stack:
        print(f"Unclosed <{tag}> at line {line_num}")

if __name__ == "__main__":
    find_unclosed_divs(sys.argv[1])
