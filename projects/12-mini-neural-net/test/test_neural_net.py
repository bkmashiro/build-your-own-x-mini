import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mini_neural_net import NeuralNet, XOR_SAMPLES, sigmoid


def test_sigmoid_bounds():
    assert 0.0 < sigmoid(-1000) < 0.5
    assert 0.5 < sigmoid(1000) <= 1.0


def test_forward_output_is_probability():
    _, output = NeuralNet(input_size=2, hidden_size=3, seed=1).forward([1.0, 0.0])
    assert 0.0 < output < 1.0


def test_train_reduces_loss():
    model = NeuralNet(input_size=2, hidden_size=3, seed=7)
    before = sum(model.train_step(inputs, target, 0.0) for inputs, target in XOR_SAMPLES) / 4
    history = model.train(XOR_SAMPLES, epochs=2500, learning_rate=0.8)
    assert history[-1] < before
    assert history[-1] < 0.18


def test_xor_predictions_converge():
    model = NeuralNet(input_size=2, hidden_size=3, seed=7)
    model.train(XOR_SAMPLES, epochs=6000, learning_rate=0.8)
    assert [model.classify(inputs) for inputs, _ in XOR_SAMPLES] == [0, 1, 1, 0]


def test_positive_cases_score_high():
    model = NeuralNet(input_size=2, hidden_size=3, seed=7)
    model.train(XOR_SAMPLES, epochs=6000, learning_rate=0.8)
    assert model.predict([0.0, 1.0]) > 0.9
    assert model.predict([1.0, 0.0]) > 0.9
