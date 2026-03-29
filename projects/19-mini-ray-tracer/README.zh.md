# mini-ray-tracer

> 一个极简 Python 光线追踪器：包含 ray-sphere intersection、BVH 加速、阴影和反射。

[English](README.md)

---

## 功能

- 球体求交与递归反射
- 基于 AABB 的 BVH 球体加速结构
- 单点光源硬阴影
- 无第三方依赖，直接输出 ASCII PPM 图片

---

## 文件

- `src/mini_ray_tracer.py`：不足 200 行的核心渲染器
- `demo.py`：构造一个带反射的场景并输出 `output.ppm`

---

## 运行方式

```bash
python projects/19-mini-ray-tracer/demo.py
```

然后用支持 PPM 的图片查看器打开 `projects/19-mini-ray-tracer/output.ppm`。

---

## 示例场景

demo 场景包含：

- 一个大型地面球
- 三个不同反射率的彩色球体
- 一个点光源，用于漫反射明暗和阴影

这样可以在很小的实现里完整展示主要渲染流程：

```text
摄像机射线
  -> BVH 遍历
  -> 球体求交
  -> 向光源发射阴影射线
  -> 反射反弹
  -> 输出最终 RGB 像素
```

---

## 说明

- 这是教学用途实现，不是物理正确渲染器。
- 使用有限反弹次数和简化的 Lambert 漫反射。
- 之所以使用 PPM，是为了只靠标准 Python 就能直接生成图片。
