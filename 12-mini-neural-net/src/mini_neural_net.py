"""
mini-neural-net — forward pass, backprop, SGD from scratch
No external libraries except math and random.
~190 lines
"""

import math
import random


# ──────────────────────────────────────────────
# Activation functions (and their derivatives)
# ──────────────────────────────────────────────

def sigmoid(x: float) -> float:
    # Clamp to avoid overflow in exp
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))

def sigmoid_prime(x: float) -> float:
    s = sigmoid(x)
    return s * (1.0 - s)

def relu(x: float) -> float:
    return max(0.0, x)

def relu_prime(x: float) -> float:
    return 1.0 if x > 0 else 0.0


# ──────────────────────────────────────────────
# Tiny matrix helpers (list-of-lists, no numpy)
# ──────────────────────────────────────────────

def mat_mul(A, B):
    """Matrix multiply A (m×k) · B (k×n) → m×n"""
    m, k = len(A), len(A[0])
    n = len(B[0])
    return [[sum(A[i][p] * B[p][j] for p in range(k)) for j in range(n)] for i in range(m)]

def mat_T(A):
    """Transpose"""
    return [[A[j][i] for j in range(len(A))] for i in range(len(A[0]))]

def mat_add(A, B):
    return [[A[i][j] + B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def mat_sub(A, B):
    return [[A[i][j] - B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def mat_scale(A, s):
    return [[A[i][j] * s for j in range(len(A[0]))] for i in range(len(A))]

def mat_hadamard(A, B):
    """Element-wise multiply"""
    return [[A[i][j] * B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def mat_apply(A, fn):
    """Apply fn element-wise"""
    return [[fn(A[i][j]) for j in range(len(A[0]))] for i in range(len(A))]

def zeros(rows, cols):
    return [[0.0] * cols for _ in range(rows)]

def rand_matrix(rows, cols, scale=1.0):
    """Xavier-ish init"""
    fan = rows + cols
    std = math.sqrt(2.0 / fan) * scale
    return [[random.gauss(0, std) for _ in range(cols)] for _ in range(rows)]


# ──────────────────────────────────────────────
# Layer definition
# ──────────────────────────────────────────────

class Layer:
    def __init__(self, in_size: int, out_size: int, activation="sigmoid"):
        self.W = rand_matrix(in_size, out_size)   # in×out
        self.b = zeros(1, out_size)               # 1×out
        self.act_fn  = relu   if activation == "relu" else sigmoid
        self.act_d   = relu_prime if activation == "relu" else sigmoid_prime
        # Cache for backprop
        self.x = None   # input (1×in)
        self.z = None   # pre-activation (1×out)
        self.a = None   # post-activation (1×out)

    def forward(self, x):
        """x: 1×in → a: 1×out"""
        self.x = x
        self.z = mat_add(mat_mul(x, self.W), self.b)   # 1×out
        self.a = mat_apply(self.z, self.act_fn)
        return self.a

    def backward(self, delta, lr: float):
        """
        delta: upstream gradient (1×out).
        Returns delta for previous layer (1×in).
        Updates W and b in-place.
        """
        # δ_local = delta ⊙ σ'(z)   — 1×out
        dz = mat_hadamard(delta, mat_apply(self.z, self.act_d))
        # ∂L/∂W = xᵀ · dz           — in×out
        dW = mat_mul(mat_T(self.x), dz)
        # ∂L/∂b = dz                 — 1×out
        db = dz
        # Gradient for previous layer: dz · Wᵀ — 1×in
        prev_delta = mat_mul(dz, mat_T(self.W))
        # SGD update
        self.W = mat_sub(self.W, mat_scale(dW, lr))
        self.b = mat_sub(self.b, mat_scale(db, lr))
        return prev_delta


# ──────────────────────────────────────────────
# Network
# ──────────────────────────────────────────────

class NeuralNet:
    def __init__(self, layer_sizes: list[int], activations: list[str] | None = None):
        """
        layer_sizes: [input_dim, hidden..., output_dim]
        activations: one per hidden+output layer; defaults to sigmoid
        """
        n = len(layer_sizes) - 1
        if activations is None:
            activations = ["sigmoid"] * n
        self.layers = [
            Layer(layer_sizes[i], layer_sizes[i + 1], activations[i])
            for i in range(n)
        ]

    def forward(self, x: list[float]) -> list[float]:
        """x: flat list → flat output"""
        a = [x]  # wrap as 1×in matrix
        for layer in self.layers:
            a = layer.forward(a)
        return a[0]  # unwrap to flat list

    def loss(self, pred: list[float], target: list[float]) -> float:
        """Mean-squared error"""
        return sum((p - t) ** 2 for p, t in zip(pred, target)) / len(pred)

    def backward(self, pred: list[float], target: list[float], lr: float):
        """MSE gradient → backprop through all layers"""
        # ∂MSE/∂pred_i = 2(pred_i - target_i) / n
        n = len(pred)
        delta = [[(2.0 * (pred[j] - target[j]) / n) for j in range(n)]]  # 1×out
        for layer in reversed(self.layers):
            delta = layer.backward(delta, lr)

    def train_step(self, x, y, lr=0.1):
        pred = self.forward(x)
        l = self.loss(pred, y)
        self.backward(pred, y, lr)
        return l

    def train(self, dataset, epochs=1000, lr=0.1, verbose=True):
        for epoch in range(1, epochs + 1):
            total_loss = 0.0
            random.shuffle(dataset)
            for x, y in dataset:
                total_loss += self.train_step(x, y, lr)
            avg = total_loss / len(dataset)
            if verbose and epoch % (epochs // 10) == 0:
                print(f"  epoch {epoch:5d}/{epochs}  loss={avg:.6f}")
        return avg
