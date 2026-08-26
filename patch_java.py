import re

with open('backend/src/main/java/com/investa/service/SharesiesService.java', 'r') as f:
    content = f.read()

# Replace if (expr instanceof Type var) {
pattern = r'if\s*\(([^()]+(?:get\([^()]+\))?[^()]*)\s+instanceof\s+([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z0-9_]+)\)\s*\{'

def repl(m):
    expr = m.group(1).strip()
    cls = m.group(2)
    var = m.group(3)
    return f'if ({expr} instanceof {cls}) {{\n            {cls} {var} = ({cls}) {expr};'

content = re.sub(pattern, repl, content)

# Also handle } else if (expr instanceof Type var) {
pattern2 = r'\}\s*else\s+if\s*\(([^()]+(?:get\([^()]+\))?[^()]*)\s+instanceof\s+([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z0-9_]+)\)\s*\{'
def repl2(m):
    expr = m.group(1).strip()
    cls = m.group(2)
    var = m.group(3)
    return f'}} else if ({expr} instanceof {cls}) {{\n            {cls} {var} = ({cls}) {expr};'

content = re.sub(pattern2, repl2, content)

# Also handle list instance of && !list.isEmpty()
pattern3 = r'if\s*\(([^()]+)\s+instanceof\s+([A-Z][a-zA-Z0-9_]*)\s+([a-zA-Z0-9_]+)\s*&&\s*!([a-zA-Z0-9_]+)\.isEmpty\(\)\)\s*\{'
def repl3(m):
    expr = m.group(1).strip()
    cls = m.group(2)
    var = m.group(3)
    var2 = m.group(4)
    if var == var2:
        return f'if ({expr} instanceof {cls} && !(({cls}) {expr}).isEmpty()) {{\n            {cls} {var} = ({cls}) {expr};'
    return m.group(0)
    
content = re.sub(pattern3, repl3, content)

# Special case for resolvedPortfolioId == null && body.get("portfolios") instanceof List list && !list.isEmpty()
content = content.replace(
    'if (resolvedPortfolioId == null && body.get("portfolios") instanceof List list && !list.isEmpty()) {',
    'if (resolvedPortfolioId == null && body.get("portfolios") instanceof List && !((List) body.get("portfolios")).isEmpty()) { List list = (List) body.get("portfolios");'
)

# Special case for if (last instanceof Map lastMap && lastMap.get("transaction_id") != null) {
content = content.replace(
    'if (last instanceof Map lastMap && lastMap.get("transaction_id") != null) {',
    'if (last instanceof Map && ((Map) last).get("transaction_id") != null) { Map lastMap = (Map) last;'
)

with open('backend/src/main/java/com/investa/service/SharesiesService.java', 'w') as f:
    f.write(content)
