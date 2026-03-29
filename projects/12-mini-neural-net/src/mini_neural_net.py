"""mini-neural-net - tiny XOR network with forward pass, backprop, and SGD."""

from __future__ import annotations

import math
import random


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-60.0, min(60.0, x))))


class NeuralNet:
    def __init__(self, input_size: int, hidden_size: int, seed: int = 0):
        rng = random.Random(seed)
        self.hidden_weights = [
            [rng.uniform(-1.0, 1.0) for _ in range(input_size)] for _ in range(hidden_size)
        ]
        self.hidden_biases = [rng.uniform(-1.0, 1.0) for _ in range(hidden_size)]
        self.output_weights = [rng.uniform(-1.0, 1.0) for _ in range(hidden_size)]
        self.output_bias = rng.uniform(-1.0, 1.0)

    def forward(self, inputs: list[float]) -> tuple[list[float], float]:
        hidden = [
            sigmoid(sum(weight * value for weight, value in zip(row, inputs)) + bias)
            for row, bias in zip(self.hidden_weights, self.hidden_biases)
        ]
        output = sigmoid(
            sum(weight * value for weight, value in zip(self.output_weights, hidden))
            + self.output_bias
        )
        return hidden, output

    def train_step(self, inputs: list[float], target: float, learning_rate: float) -> float:
        hidden, output = self.forward(inputs)
        output_delta = output - target
        hidden_deltas = [
            output_delta * self.output_weights[i] * hidden[i] * (1.0 - hidden[i])
            for i in range(len(hidden))
        ]

        for i, value in enumerate(hidden):
            self.output_weights[i] -= learning_rate * output_delta * value
        self.output_bias -= learning_rate * output_delta

        for i, row in enumerate(self.hidden_weights):
            for j, value in enumerate(inputs):
                row[j] -= learning_rate * hidden_deltas[i] * value
            self.hidden_biases[i] -= learning_rate * hidden_deltas[i]

        clipped = min(max(output, 1e-9), 1.0 - 1e-9)
        return -(target * math.log(clipped) + (1.0 - target) * math.log(1.0 - clipped))

    def train(
        self,
        samples: list[tuple[list[float], float]],
        epochs: int = 5000,
        learning_rate: float = 0.8,
    ) -> list[float]:
        history: list[float] = []
        for _ in range(epochs):
            loss = 0.0
            for inputs, target in samples:
                loss += self.train_step(inputs, target, learning_rate)
            history.append(loss / len(samples))
        return history

    def predict(self, inputs: list[float]) -> float:
        return self.forward(inputs)[1]

    def classify(self, inputs: list[float]) -> int:
        return int(self.predict(inputs) >= 0.5)


XOR_SAMPLES = [
    ([0.0, 0.0], 0.0),
    ([0.0, 1.0], 1.0),
    ([1.0, 0.0], 1.0),
    ([1.0, 1.0], 0.0),
]
