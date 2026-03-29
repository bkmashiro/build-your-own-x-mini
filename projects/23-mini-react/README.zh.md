# mini-react

約200行のPythonで実装したReact風ミニレンダラー。
仮想DOM・ファイバーリコンサイラー・`useState`/`useEffect`フックをゼロから実装。

## コアコンセプト

| 概念 | 説明 |
|------|------|
| **VNode** | 不変の仮想DOMノード（`type`・`props`・`key`） |
| **Fiber** | ミュータブルな作業単位 — DOMへの参照・フックリスト・alternateポインタを保持 |
| **リコンサイラー** | 旧／新ファイバーツリーをdiffし、各fiberに`PLACEMENT`/`UPDATE`/`DELETION`タグを付与 |
| **コミットフェーズ** | エフェクトタグを一括でDOMへ反映 |
| **`useState`** | `{state, queue}`を`fiber.hooks`に格納し、再レンダー時にqueueを再生 |
| **`useEffect`** | レンダー中に収集したコールバックをコミット後に実行 |

## アーキテクチャ

```
render(vnode, container)
  │
  ├─ wip_root Fiber を生成（alternate = current_root）
  │
  ├─ _perform_work()          ← 深さ優先でファイバーを走査
  │    └─ _begin_work(fiber)
  │         ├─ 関数コンポーネント → fn 呼び出し → 子をリコンサイル
  │         └─ ホスト要素        → DOMノード生成 → 子をリコンサイル
  │
  └─ _commit_root()
       ├─ 削除ファイバーの処理
       ├─ _commit_work()       ← ファイバーツリーを走査してエフェクト反映
       └─ useEffect コールバック実行
```

## 使い方

```python
from mini_react import h, render, use_state, use_effect, DOMNode

def Counter(props):
    count, set_count = use_state(0)
    use_effect(lambda: print(f"count = {count}"), [count])
    return h("div", {}, f"Count: {count}")

root = DOMNode("body", {})
render(h(Counter, {}), root)
print(root.render())
# <body>
#   <div>
#     Count: 0
#   </div>
# </body>
```

## デモ

```bash
python demo.py
```

デモの内容：
1. ネストしたコンポーネントツリーの初回レンダー
2. フックキューを使ったカウンター状態更新（+1）
3. 累積的な状態更新（+4）
4. リスト差分処理（Todoアイテムの追加）

## ファイル構成

```
src/mini_react.py   約215行 — コア実装
demo.py             デモスクリプト
```

## 本物のReactとの主な違い

- 非同期・並行レンダリングなし（ワークループは同期実行）
- keyによるリスト並べ替えなし（keyはパースするが再順序付けには未使用）
- DOMはPythonオブジェクトツリー（ブラウザ不要、HTML文字列として出力）
- `useReducer`・`useRef`・`useContext`・`useMemo`は未実装
