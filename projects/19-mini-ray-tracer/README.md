# mini-ray-tracer

> A tiny Python ray tracer with ray-sphere intersection, BVH acceleration, shadows, and reflections.

[中文](README.zh.md)

---

## Features

- Ray-sphere intersection with recursive reflections
- BVH acceleration over spheres using axis-aligned bounding boxes
- Hard shadows from a single point light
- ASCII PPM output with no external dependencies

---

## Files

- `src/mini_ray_tracer.py`: core renderer in under 200 lines
- `demo.py`: builds a small reflective scene and writes `output.ppm`

---

## How to Run

```bash
python projects/19-mini-ray-tracer/demo.py
```

Then open `projects/19-mini-ray-tracer/output.ppm` in any image viewer that supports PPM.

---

## Example

The demo scene includes:

- a large ground sphere
- three colored spheres with different reflectivity
- one point light for diffuse shading and shadows

This keeps the implementation small while still showing the main rendering pipeline:

```text
camera ray
  -> BVH traversal
  -> sphere hit test
  -> shadow ray to light
  -> reflection bounce
  -> final RGB pixel
```

---

## Notes

- This is a teaching implementation, not a physically based renderer.
- It uses a single bounce limit and simple Lambert-style diffuse shading.
- PPM is intentionally used so the output can be generated with plain Python only.
