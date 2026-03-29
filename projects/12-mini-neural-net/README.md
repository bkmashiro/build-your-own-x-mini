# mini-neural-net

> A tiny neural network in pure Python: one hidden layer, backpropagation, SGD, and an XOR demo.

[中文](README.zh.md)

---

## Background

The smallest neural network that feels real is usually:

- a dense hidden layer
- a nonlinear activation function
- a scalar output
- gradient-based weight updates

XOR is the classic toy problem because a single linear classifier cannot solve it. As soon as you add one hidden layer and train with backpropagation, the network can bend the decision boundary enough to separate the four points.

---

## Architecture

```text
[x1, x2]
   │
   ▼
dense hidden layer
   │
   ▼
sigmoid activation
   │
   ▼
dense output node
   │
   ▼
probability in (0, 1)
```

Training is standard stochastic gradient descent:

1. run a forward pass to get hidden activations and output probability
2. compute output error against the target
3. propagate that error back into the hidden layer
4. nudge weights and biases opposite the gradient

---

## Key Implementation

### Forward pass

Each hidden neuron computes a weighted sum plus bias, then applies `sigmoid`. The output neuron does the same on top of hidden activations.

### Backpropagation

The output delta is `prediction - target`. Hidden deltas reuse the output delta scaled by each outgoing weight and the sigmoid derivative `h * (1 - h)`.

### SGD

Every sample immediately updates the parameters. That keeps the code small and makes the training loop easy to inspect.

---

## How to Run

```bash
python projects/12-mini-neural-net/demo.py
python -m pytest projects/12-mini-neural-net/test -q
```

The default demo trains on XOR and prints the final score for each input pair.

---

## What This Omits

- matrix math libraries like NumPy
- multiple hidden layers
- mini-batching and momentum
- softmax / multiclass output
- model serialization

Those features matter for larger networks, but they are not required to understand how forward pass + backprop + SGD fit together.
