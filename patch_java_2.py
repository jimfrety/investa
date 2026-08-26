import re

with open('backend/src/main/java/com/investa/service/SharesiesService.java', 'r') as f:
    content = f.read()

# Replace if (o instanceof Map m) -> if (o instanceof Map) { Map m = (Map) o;
content = re.sub(
    r'if\s*\(([^()]+)\s+instanceof\s+([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z0-9_]+)\)\s+([^{}\n]+);',
    r'if (\1 instanceof \2) { \2 \3 = (\2) \1; \4; }',
    content
)

# Replace any lingering `instanceof Type var` that isn't replaced
def replace_lingering(m):
    expr = m.group(1).strip()
    cls = m.group(2)
    var = m.group(3)
    return f'{expr} instanceof {cls}'

content = re.sub(r'([^()]+)\s+instanceof\s+([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z0-9_]+)', replace_lingering, content)

with open('backend/src/main/java/com/investa/service/SharesiesService.java', 'w') as f:
    f.write(content)
