from pathlib import Path
import sys

ROOT = Path(__file__).parent
sys.path.append(str(ROOT / "src"))

from mini_search import MiniSearch


docs = [
    {
        "id": "raft",
        "title": "Raft consensus explained",
        "text": "Raft uses leader election, replicated logs, and majority quorum to keep a cluster consistent.",
    },
    {
        "id": "search",
        "title": "How search engines rank documents",
        "text": "A search engine builds an inverted index, scores tf idf signals, and often applies BM25 for ranking.",
    },
    {
        "id": "db",
        "title": "Building a tiny database",
        "text": "A database needs indexes, query planning, and storage layouts for predictable point reads.",
    },
    {
        "id": "ml",
        "title": "Neural nets from scratch",
        "text": "Gradient descent and backpropagation train a neural network on small labeled datasets.",
    },
]

engine = MiniSearch(docs)
for query in ("leader election quorum", "inverted index bm25 ranking", "indexes for point reads"):
    print(f"\nQuery: {query}")
    for method in ("tfidf", "bm25"):
        print(f"  {method.upper()}:")
        for hit in engine.search(query, method=method, limit=3):
            print(f"    {hit['id']:>6}  score={hit['score']:<6}  {hit['title']}")
