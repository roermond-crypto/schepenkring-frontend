import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()

    stack = []
    lines = content.split('\n')
    
    in_string = None
    in_comment = False
    in_multiline_comment = False
    
    for row, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            char = line[i]
            
            # Handle comments
            if not in_string:
                if in_multiline_comment:
                    if line[i:i+2] == '*/':
                        in_multiline_comment = False
                        i += 2
                        continue
                elif line[i:i+2] == '/*':
                    in_multiline_comment = True
                    i += 2
                    continue
                elif line[i:i+2] == '//':
                    break # Rest of line is comment
            
            if in_multiline_comment:
                i += 1
                continue
                
            # Handle strings
            if char in '"\'`':
                if not in_string:
                    in_string = char
                elif in_string == char:
                    # Check for escape
                    if i > 0 and line[i-1] == '\\':
                        # Simplistic escape check
                        pass
                    else:
                        in_string = None
                i += 1
                continue
            
            if in_string:
                i += 1
                continue
                
            # Handle brackets
            if char in '{[(':
                stack.append((char, row, i+1))
            elif char in '}])':
                if not stack:
                    print(f"Extra closing {char} at line {row}, col {i+1}")
                else:
                    opening, o_row, o_col = stack.pop()
                    if (opening == '{' and char != '}') or \
                       (opening == '[' and char != ']') or \
                       (opening == '(' and char != ')'):
                        print(f"Mismatched {char} at line {row}, col {i+1} (expected closing for {opening} at line {o_row})")
            
            i += 1

    while stack:
        opening, o_row, o_col = stack.pop()
        print(f"Unclosed {opening} at line {o_row}, col {o_col}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
