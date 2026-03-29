# mini-browser

> 一个极小的 Python 终端浏览器：HTML 词法切分、CSS 规则匹配、盒模型布局，以及字符画渲染。

[English](README.md)

---

## 背景

浏览器本质上是一条流水线：

- 把标记语言切成 token
- 构建树结构
- 绑定 CSS 规则
- 计算盒模型
- 最终绘制

这个项目把这条链路压缩成一个极小实现，只不过输出目标不是像素，而是终端字符。它不是完整浏览器，但足够把渲染树和布局流程展示出来。

---

## 架构

```text
HTML
  -> tokenizer
  -> DOM 树
  -> CSS 解析
  -> 样式匹配
  -> 块级布局
  -> 终端画布
```

支持的部分：

- HTML 开始标签、结束标签、文本节点和 `<style>`
- CSS 标签选择器、`.class`、`#id`
- `width`、`height`、`margin`、`padding`、`border`
- 纵向块布局
- ASCII 边框绘制和文本换行

---

## 关键实现

### HTML tokenizer

`tokenize_html()` 用一个正则把源码切成标签和文本块。随后 `parse_html()` 用栈构建一个极小 DOM。

### CSS 匹配

`parse_css()` 读取 `selector { prop: value }` 形式的规则。每个节点会合并所有命中的声明。为了保持简单，选择器只支持标签、类和 id。

### 盒模型与布局

每个元素都会计算：

- margin
- border
- padding
- 内部宽度
- 子节点堆叠后的高度

子节点按照从上到下的顺序布局，接近浏览器里最基础的块级流式布局。

### 终端渲染

这里没有像素帧缓冲，而是分配一个二维字符画布。边框使用 `+`、`-`、`|`，文本则按内容区域宽度换行后写入画布。

---

## 运行方式

```bash
python projects/16-mini-browser/demo.py
```

demo 会在终端里渲染一张带边框的卡片。

---

## 省略了什么

- inline layout 和 line box
- selector specificity 与完整 cascade 细节
- 颜色、字体、ANSI 样式
- 滚动、事件、JavaScript、网络加载

这些都是更大的子系统。这里的目标是理解渲染流水线，而不是追求标准兼容性。
