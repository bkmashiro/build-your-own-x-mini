import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mini_lisp import Env, GLOBAL_ENV, evaluate, parse, run, tokenize


def fresh_env():
    return Env(outer=GLOBAL_ENV)


def test_tokenize_and_parse_quote():
    assert tokenize("'(1 2 3)") == ["'", "(", "1", "2", "3", ")"]
    assert parse("'(1 2 3)") == ["quote", [1, 2, 3]]


def test_define_and_closure():
    program = """
    (begin
      (define make-adder (lambda (n) (lambda (x) (+ x n))))
      (define add3 (make-adder 3))
      (add3 9))
    """
    assert run(program, fresh_env()) == 12


def test_quote_and_list_ops():
    env = fresh_env()
    assert run("(car '(9 8 7))", env) == 9
    assert run("(cdr '(9 8 7))", env) == [8, 7]
    assert run("(cons 1 '(2 3))", env) == [1, 2, 3]


def test_tail_recursive_sumdown_handles_large_input():
    env = fresh_env()
    evaluate(
        parse(
            """
            (define sumdown
              (lambda (n acc)
                (if (= n 0)
                    acc
                    (sumdown (- n 1) (+ acc n)))))
            """
        ),
        env,
    )
    assert evaluate(parse("(sumdown 2000 0)"), env) == 2001000
