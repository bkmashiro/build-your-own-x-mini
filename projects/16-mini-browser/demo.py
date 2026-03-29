from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent / "src"))
from mini_browser import render


HTML = """
<html>
  <body>
    <style>
      body { padding: 1px; }
      .card { margin: 1px; padding: 1px; border: 1px; width: 46px; }
      h1 { border: 1px; padding: 1px; }
      p { margin: 1px; }
      #cta { border: 1px; padding: 1px; width: 24px; }
    </style>
    <div class="card">
      <h1>Mini Browser</h1>
      <p>HTML becomes a DOM tree. CSS attaches a box model. Layout stacks blocks vertically.</p>
      <div id="cta">painted into terminal cells</div>
    </div>
  </body>
</html>
"""

print(render(HTML))
