from src.mini_neural_net import NeuralNet, XOR_SAMPLES


def main() -> None:
    model = NeuralNet(input_size=2, hidden_size=3, seed=7)
    history = model.train(XOR_SAMPLES, epochs=6000, learning_rate=0.8)

    print(f"final loss: {history[-1]:.4f}")
    for inputs, target in XOR_SAMPLES:
        score = model.predict(inputs)
        print(f"{inputs} -> {score:.3f} (target={int(target)})")


if __name__ == "__main__":
    main()
