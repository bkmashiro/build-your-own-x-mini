from pathlib import Path
import sys

ROOT = Path(__file__).parent
sys.path.append(str(ROOT / "src"))

from mini_compiler import compile_source, run


source = """
x = 2 + 3 * 4
y = (x - 5) / 3
x + y
""".strip()

tokens, ast, code = compile_source(source)

print("== Tokens ==")
print(tokens)

print("\n== AST ==")
print(ast)

print("\n== Stack Code ==")
for line in code:
    print(line)

env, result = run(code)

print("\n== Result ==")
print("env =", env)
print("result =", result)
