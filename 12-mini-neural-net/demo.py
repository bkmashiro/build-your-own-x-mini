"""
demo.py — mini-neural-net demos
Runs 3 classic tasks: XOR, sine regression, and 2-class circle classification.
No external dependencies.
"""

import math
import random
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from mini_neural_net import NeuralNet

random.seed(42)


# ──────────────────────────────────────────────
# Demo 1: XOR (the classic "neural nets can solve non-linear problems" demo)
# ──────────────────────────────────────────────

def demo_xor():
    print("=" * 50)
    print("Demo 1: XOR")
    print("=" * 50)

    # XOR truth table
    data = [
        ([0.0, 0.0], [0.0]),
        ([0.0, 1.0], [1.0]),
        ([1.0, 0.0], [1.0]),
        ([1.0, 1.0], [0.0]),
    ]

    # 2 inputs → 4 hidden → 1 output
    net = NeuralNet([2, 4, 1])
    print("Training…")
    net.train(data, epochs=5000, lr=0.5)

    print("\nResults:")
    for x, y in data:
        pred = net.forward(x)
        label = round(pred[0])
        status = "✓" if label == int(y[0]) else "✗"
        print(f"  {int(x[0])} XOR {int(x[1])} = {pred[0]:.4f}  (→{label})  {status}")


# ──────────────────────────────────────────────
# Demo 2: Sine regression
# Fit y = sin(x) on [0, π] with 40 training points
# ──────────────────────────────────────────────

def demo_sine():
    print("\n" + "=" * 50)
    print("Demo 2: Sine regression  y = sin(x)")
    print("=" * 50)

    # Normalise x to [0,1] and y from [-1,1] to [0,1]
    n_train = 40
    data = []
    for _ in range(n_train):
        x_raw = random.uniform(0, math.pi)
        y_raw = math.sin(x_raw)
        x_norm = x_raw / math.pi          # → [0,1]
        y_norm = (y_raw + 1.0) / 2.0      # → [0,1]
        data.append(([x_norm], [y_norm]))

    net = NeuralNet([1, 16, 16, 1])
    print("Training…")
    net.train(data, epochs=3000, lr=0.05)

    # Spot-check a few test points
    print("\nTest (denormalised):")
    test_xs = [0.0, math.pi / 6, math.pi / 4, math.pi / 2, math.pi]
    for x_raw in test_xs:
        x_norm = x_raw / math.pi
        y_pred_norm = net.forward([x_norm])[0]
        y_pred = y_pred_norm * 2.0 - 1.0
        y_true = math.sin(x_raw)
        err = abs(y_pred - y_true)
        print(f"  sin({x_raw:.4f}) = {y_true:+.4f}  pred={y_pred:+.4f}  err={err:.4f}")


# ──────────────────────────────────────────────
# Demo 3: Circle classification
# Inside unit circle → class 1, outside → class 0
# ──────────────────────────────────────────────

def demo_circle():
    print("\n" + "=" * 50)
    print("Demo 3: 2-class circle classification")
    print("=" * 50)

    r = 0.55  # decision boundary radius in [-1,1] space

    def make_point():
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        label = 1.0 if math.sqrt(x * x + y * y) < r else 0.0
        # Normalize to [0,1]
        return ([x * 0.5 + 0.5, y * 0.5 + 0.5], [label])

    data = [make_point() for _ in range(200)]

    net = NeuralNet([2, 8, 8, 1])
    print("Training…")
    net.train(data, epochs=2000, lr=0.1)

    # Evaluate on 100 fresh points
    correct = 0
    total = 100
    for _ in range(total):
        x_raw = random.uniform(-1, 1)
        y_raw = random.uniform(-1, 1)
        label = 1.0 if math.sqrt(x_raw ** 2 + y_raw ** 2) < r else 0.0
        pred = net.forward([x_raw * 0.5 + 0.5, y_raw * 0.5 + 0.5])[0]
        if round(pred) == int(label):
            correct += 1
    acc = correct / total * 100
    print(f"\n  Accuracy on 100 test points: {correct}/{total} ({acc:.1f}%)")


if __name__ == "__main__":
    demo_xor()
    demo_sine()
    demo_circle()
    print("\nAll demos complete.")
