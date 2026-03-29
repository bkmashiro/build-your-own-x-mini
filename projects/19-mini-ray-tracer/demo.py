from pathlib import Path
import sys

ROOT = Path(__file__).parent
sys.path.append(str(ROOT / "src"))

from mini_ray_tracer import Scene, Sphere, write_ppm


scene = Scene(
    [
        Sphere((0, -1001, 2.5), 1000, (0.85, 0.85, 0.82), 0.05),
        Sphere((-0.9, -0.1, 2.6), 0.7, (0.95, 0.25, 0.2), 0.25),
        Sphere((0.55, 0.1, 2.1), 0.5, (0.2, 0.65, 1.0), 0.7),
        Sphere((1.45, -0.2, 3.2), 0.8, (0.95, 0.8, 0.3), 0.15),
    ],
    light=(4, 5, -2),
)
output = ROOT / "output.ppm"
write_ppm(output, scene.render(320, 180, samples=2))
print(f"Rendered {output}")
