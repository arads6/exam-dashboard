import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    
    # Strip comments and strings roughly to avoid false positives
    for i, line in enumerate(lines):
        for char in line:
            if char == '{':
                stack.append((i+1, '{'))
            elif char == '}':
                if not stack:
                    print(f"Error: unmatched '}}' at line {i+1}")
                    return
                top = stack.pop()
                if top[1] != '{':
                    print(f"Error: mismatched brackets at line {i+1}")
                    return
            
    if stack:
        print("Unclosed braces found:")
        for line, char in stack:
            print(f"Line {line}: {char}")
    else:
        print("Braces are perfectly balanced!")

check_braces('app.js')
