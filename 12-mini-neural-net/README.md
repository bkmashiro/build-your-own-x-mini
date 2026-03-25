# mini-neural-net

> Forward pass, backpropagation, and SGD from scratch — no numpy, no frameworks, ~190 lines of pure Python.

**[中文](./README.zh.md)**

---

## Background

Neural networks dominated the 2010s because three deceptively simple ideas combined to scale:

1. **Universal approximation** — a network with at least one hidden layer can approximate any continuous function.
2. **Backpropagation** — the chain rule of calculus, applied recursively, makes gradient computation tractable.
3. **SGD** — gradient descent with shuffled mini-batches escapes local minima and generalises well.

This implementation builds all three from scratch using only Python's `math` and `random` modules. No numpy. Every matrix operation is a list comprehension. The goal is to understand *exactly* what happens during training — no magic.

---

## Architecture

```
Input layer  →  [Dense + Activation]×N  →  Output layer
                     ↕ forward pass
             Loss (MSE) = Σ (pred - target)² / n
                     ↕ backward pass
             ∂L/∂W via chain rule → SGD update
```

### Components

| Component | File | Role |
|-----------|------|------|
| `Layer` | `src/mini_neural_net.py` | Holds W, b; forward + backward |
| `NeuralNet` | `src/mini_neural_net.py` | Stacks layers; orchestrates train loop |
| Matrix helpers | `src/mini_neural_net.py` | Pure-Python matmul, transpose, hadamard |
| Activations | `src/mini_neural_net.py` | sigmoid, ReLU and their derivatives |

---

## Key Implementation Details

### Forward Pass

Each layer computes:

```
z = x · W + b          # linear transform (1×in) · (in×out) → (1×out)
a = σ(z)               # element-wise activation
```

The output of one layer feeds directly into the next.

### Backward Pass (Backpropagation)

Starting from the MSE gradient:

```
δ_output = 2(pred - target) / n         # ∂MSE/∂pred
```

For each layer (in reverse):

```
δ_local = δ_upstream ⊙ σ'(z)           # Hadamard product with activation derivative
∂L/∂W   = xᵀ · δ_local                 # weight gradient
∂L/∂b   = δ_local                       # bias gradient
δ_prev  = δ_local · Wᵀ                  # gradient flowing to previous layer
```

Then SGD update:

```
W ← W - lr · ∂L/∂W
b ← b - lr · ∂L/∂b
```

### Weight Initialisation

Xavier-ish initialisation: `std = sqrt(2 / (fan_in + fan_out))`. This keeps activations from saturating in early epochs — crucial for sigmoid networks.

### Why MSE, not Cross-Entropy?

MSE is simpler to implement and sufficient for regression and binary tasks. For multi-class classification you'd swap in softmax + cross-entropy, but that obscures the backprop logic we're trying to illustrate.

---

## How to Run

```bash
# No dependencies needed
python3 demo.py
```

Three demos run in sequence:

1. **XOR** — 2-input, 1-hidden layer (4 neurons), 5 000 epochs. Network learns the non-linear XOR function that a single-layer perceptron cannot.
2. **Sine regression** — Fits `y = sin(x)` on `[0, π]` with 40 training points and 2 hidden layers.
3. **Circle classification** — 200 training points, classifies whether a 2D point is inside a circle at 99%+ accuracy.

Expected output (XOR section):

```
0 XOR 1 = 0.9846  (→1)  ✓
0 XOR 0 = 0.0087  (→0)  ✓
1 XOR 1 = 0.0239  (→0)  ✓
1 XOR 0 = 0.9832  (→1)  ✓
```

---

## Key Takeaways

- **Backprop is just the chain rule** — written layer-by-layer in reverse, it's 4 lines per layer.
- **Matrix shapes are everything** — tracking `(1×in)`, `(in×out)`, `(1×out)` through each operation eliminates bugs.
- **Activation derivatives are pre-computed** — `σ'(z)` needs the *pre-activation* `z`, so we cache it during the forward pass.
- **Xavier init matters** — random weights with the wrong scale cause vanishing/exploding gradients from epoch 1.
- **No magic** — PyTorch/JAX do exactly this, but with GPU kernels, autograd tapes, and batching. The math is identical.
