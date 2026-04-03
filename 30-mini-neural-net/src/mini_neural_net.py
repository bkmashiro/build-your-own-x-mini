"""
mini_neural_net.py — A feedforward neural network from scratch.

Architecture:
  Layer (weights + bias) → forward() + backward()
  Network              → stacks layers, runs forward/backward pass
  SGD                  → vanilla gradient descent weight update

No numpy required; uses only Python lists.
Trains on the XOR problem to verify the whole pipeline works.
"""

import math
import random


# ---------------------------------------------------------------------------
# Math helpers (no numpy)
# ---------------------------------------------------------------------------

def dot(a, b):
    """Dot product of two flat vectors."""
    return sum(x * y for x, y in zip(a, b))

def mat_vec(W, x):
    """Matrix-vector multiply: W is list-of-rows, x is flat vector."""
    return [dot(row, x) for row in W]

def vec_add(a, b):
    return [x + y for x, y in zip(a, b)]

def scalar_mul(s, v):
    return [s * x for x in v]

def outer(a, b):
    """Outer product → list of rows."""
    return [[ai * bj for bj in b] for ai in a]


# ---------------------------------------------------------------------------
# Activation functions and their derivatives
# ---------------------------------------------------------------------------

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))

def sigmoid_prime(x):
    s = sigmoid(x)
    return s * (1.0 - s)

def relu(x):
    return max(0.0, x)

def relu_prime(x):
    return 1.0 if x > 0.0 else 0.0

ACTIVATIONS = {
    "sigmoid": (sigmoid, sigmoid_prime),
    "relu":    (relu,    relu_prime),
}


# ---------------------------------------------------------------------------
# Dense layer
# ---------------------------------------------------------------------------

class Layer:
    """One fully-connected layer with bias.

    Stores:
      W   — weight matrix [out_size × in_size]
      b   — bias vector   [out_size]

    During the forward pass we cache the pre-activation values (z) and the
    input (x) so that backprop can reuse them without recomputation.
    """

    def __init__(self, in_size, out_size, activation="sigmoid", seed=None):
        rng = random.Random(seed)
        # He/Xavier-ish: scale by sqrt(2/in_size) — works for both sigmoid/relu
        scale = math.sqrt(2.0 / in_size)
        self.W = [[rng.gauss(0, scale) for _ in range(in_size)]
                  for _ in range(out_size)]
        self.b = [0.0] * out_size
        self.act, self.act_prime = ACTIVATIONS[activation]

        # Cached values populated by forward()
        self._x = None   # input to this layer
        self._z = None   # pre-activation (W·x + b)

        # Gradients accumulated by backward(), consumed by optimizer
        self.dW = [[0.0] * in_size for _ in range(out_size)]
        self.db = [0.0] * out_size

    # -- Forward pass --------------------------------------------------------

    def forward(self, x):
        """Compute a = act(W·x + b), cache x and z for backprop."""
        self._x = x
        self._z = vec_add(mat_vec(self.W, x), self.b)   # z = W·x + b
        return [self.act(zi) for zi in self._z]          # a = act(z)

    # -- Backward pass -------------------------------------------------------

    def backward(self, grad_a):
        """Given ∂L/∂a, compute ∂L/∂x and accumulate ∂L/∂W, ∂L/∂b.

        Chain rule:
          δ   = ∂L/∂a ⊙ act'(z)          (element-wise)
          ∂L/∂W = δ · xᵀ                  (outer product)
          ∂L/∂b = δ
          ∂L/∂x = Wᵀ · δ                  (pass upstream)
        """
        # δ: gradient at pre-activation
        delta = [da * self.act_prime(zi)
                 for da, zi in zip(grad_a, self._z)]

        # Accumulate weight / bias gradients
        grad_W = outer(delta, self._x)
        for i in range(len(self.dW)):
            for j in range(len(self.dW[i])):
                self.dW[i][j] += grad_W[i][j]
        for i in range(len(self.db)):
            self.db[i] += delta[i]

        # Gradient w.r.t. input (passed to previous layer)
        # ∂L/∂x = Wᵀ · δ  →  for each input j: sum over i of W[i][j]*delta[i]
        grad_x = [sum(self.W[i][j] * delta[i] for i in range(len(delta)))
                  for j in range(len(self._x))]
        return grad_x

    def zero_grad(self):
        out, inp = len(self.W), len(self.W[0])
        self.dW = [[0.0] * inp for _ in range(out)]
        self.db = [0.0] * out


# ---------------------------------------------------------------------------
# Network: stack of layers
# ---------------------------------------------------------------------------

class Network:
    """Feedforward network: input → [Layer] → scalar output."""

    def __init__(self, layers):
        self.layers = layers

    def forward(self, x):
        for layer in self.layers:
            x = layer.forward(x)
        return x

    def backward(self, grad):
        """Backpropagate gradient from loss through all layers (right to left)."""
        for layer in reversed(self.layers):
            grad = layer.backward(grad)

    def zero_grad(self):
        for layer in self.layers:
            layer.zero_grad()


# ---------------------------------------------------------------------------
# Loss: mean-squared error
# ---------------------------------------------------------------------------

def mse_loss(pred, target):
    """MSE loss and its gradient w.r.t. pred."""
    n = len(pred)
    loss = sum((p - t) ** 2 for p, t in zip(pred, target)) / n
    grad = [(2.0 / n) * (p - t) for p, t in zip(pred, target)]
    return loss, grad


# ---------------------------------------------------------------------------
# Optimizer: SGD
# ---------------------------------------------------------------------------

class SGD:
    """Vanilla stochastic gradient descent."""

    def __init__(self, network, lr=0.1):
        self.network = network
        self.lr = lr

    def step(self):
        """Apply accumulated gradients and clear them."""
        for layer in self.network.layers:
            for i in range(len(layer.W)):
                for j in range(len(layer.W[i])):
                    layer.W[i][j] -= self.lr * layer.dW[i][j]
            for i in range(len(layer.b)):
                layer.b[i] -= self.lr * layer.db[i]
            layer.zero_grad()


# ---------------------------------------------------------------------------
# Demo: train on XOR
# ---------------------------------------------------------------------------

def train_xor(epochs=5000, lr=0.5, seed=42):
    """XOR is the classic NN sanity-check: not linearly separable."""
    XOR_X = [[0, 0], [0, 1], [1, 0], [1, 1]]
    XOR_Y = [[0],    [1],    [1],    [0]]

    net = Network([
        Layer(2, 4, activation="sigmoid", seed=seed),
        Layer(4, 1, activation="sigmoid", seed=seed + 1),
    ])
    opt = SGD(net, lr=lr)

    for epoch in range(1, epochs + 1):
        total_loss = 0.0
        for x, y in zip(XOR_X, XOR_Y):
            net.zero_grad()
            pred = net.forward(x)
            loss, grad = mse_loss(pred, y)
            total_loss += loss
            net.backward(grad)
            opt.step()

        if epoch % 1000 == 0:
            print(f"Epoch {epoch:5d}  loss={total_loss / len(XOR_X):.6f}")

    print("\nFinal predictions:")
    for x, y in zip(XOR_X, XOR_Y):
        pred = net.forward(x)
        print(f"  {x} → {pred[0]:.4f}  (target {y[0]})")


if __name__ == "__main__":
    train_xor()
