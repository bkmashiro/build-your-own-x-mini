from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_lisp import run


PROGRAM = """
(begin
  (define make-adder (lambda (n) (lambda (x) (+ x n))))
  (define add7 (make-adder 7))
  (define sumdown
    (lambda (n acc)
      (if (= n 0)
          acc
          (sumdown (- n 1) (+ acc n)))))
  (list (add7 5) (sumdown 100 0) '(1 2 done)))
"""


if __name__ == "__main__":
    print(run(PROGRAM))
