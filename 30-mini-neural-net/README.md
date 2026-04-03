# 30 — mini-neural-net

> A feedforward neural network from scratch in pure Python — under 200 lines of logic, no external dependencies.

## Background

Neural networks look intimidating until you see that they are just:

1. A sequence of matrix multiplications and non-linear functions (the **forward pass**).
2. The **chain rule** applied in reverse to compute how each weight contributed to the error (the **backward pass**).
3. A simple rule for nudging each weight in the direction that reduces the error (**gradient descent**).

This project implements all three ideas with plain Python lists — no numpy, no autograd. Every derivative is written out explicitly so you can see exactly how the chain rule threads through the network.

## Architecture

### 1. Layer

Each dense layer stores:

- `W` — weight matrix `[out_size × in_size]`
- `b` — bias vector `[out_size]`

**Forward pass**: `z = W·x + b`, then `a = act(z)`.

The layer caches `x` (the input) and `z` (the pre-activation) because the backward pass needs them.

**Backward pass**: given `∂L/∂a` from the layer above, the chain rule gives:

```
δ      = ∂L/∂a ⊙ act′(z)    # element-wise product with activation derivative
∂L/∂W  = δ · xᵀ              # outer product
∂L/∂b  = δ
∂L/∂x  = Wᵀ · δ              # passed upstream to the previous layer
```

### 2. Network

A `Network` is just a list of `Layer` objects. `forward()` threads data left to right; `backward()` threads gradients right to left, each layer returning `∂L/∂x` for the layer before it.

### 3. Loss: MSE

Mean-squared error and its gradient with respect to the prediction:

```
L       = (1/n) Σ (pred - target)²
∂L/∂pred = (2/n)(pred - target)
```

The gradient is the seed that starts the backward pass.

### 4. Optimizer: SGD

Vanilla stochastic gradient descent updates each parameter after every sample:

```
W ← W − lr · ∂L/∂W
b ← b − lr · ∂L/∂b
```

## Key Implementation

### Chain rule as code

The heart of backprop is a single mechanical application of the chain rule at each layer. In `Layer.backward()`:

```python
delta = [da * self.act_prime(zi) for da, zi in zip(grad_a, self._z)]
```

`grad_a` is what the layer above says: "this is how much the loss changes if you change each of my outputs." Multiplying by `act′(z)` converts that from activation-space back to pre-activation-space (`z`). Everything else — `dW`, `db`, `grad_x` — follows directly.

### Why XOR?

XOR cannot be solved with a single layer (it is not linearly separable). Adding one hidden layer with a non-linear activation gives the network enough capacity. This makes XOR the minimal proof that multi-layer networks learn things a single perceptron cannot.

### Activation functions

Two activations are included:

| Name    | Formula          | Derivative             |
|:--------|:-----------------|:-----------------------|
| sigmoid | `1 / (1 + e^-x)` | `s(x) · (1 − s(x))`   |
| relu    | `max(0, x)`      | `1 if x > 0 else 0`   |

Sigmoid is used in the demo because it keeps outputs in `(0, 1)`, matching the binary XOR targets.

## How to Run

```bash
python3 src/mini_neural_net.py
```

Expected output after training for 5 000 epochs:

```
Epoch  1000  loss=0.003517
Epoch  2000  loss=0.000971
Epoch  3000  loss=0.000544
Epoch  4000  loss=0.000373
Epoch  5000  loss=0.000283

Final predictions:
  [0, 0] → 0.0089  (target 0)
  [0, 1] → 0.9851  (target 1)
  [1, 0] → 0.9832  (target 1)
  [1, 1] → 0.0234  (target 0)
```

## Key Takeaways

- A neural network is a composition of simple functions; backprop is just the chain rule applied to that composition.
- Each layer only needs two things from the forward pass: the input `x` and the pre-activation `z`. Everything else can be recomputed.
- The backward pass propagates a gradient signal from the loss back through every layer. Each layer transforms the signal and passes it on.
- SGD is the simplest optimizer and already sufficient to solve XOR. More advanced optimizers (Adam, RMSProp) apply the same update rule with adaptive learning rates.
- This implementation is intentionally slow — the goal is readability, not performance. A production network would vectorize across the batch dimension using numpy or a tensor library.
