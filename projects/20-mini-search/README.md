# mini-search

> A tiny Python search engine with an inverted index, TF-IDF weights, BM25 ranking, and query scoring.

[中文](README.zh.md)

---

## Features

- Builds an inverted index from a small document collection
- Computes TF-IDF document/query weights for cosine-style ranking
- Applies BM25 scoring for stronger lexical ranking
- Returns ranked results for a free-text query with no external dependencies

---

## Files

- `src/mini_search.py`: core search engine in under 200 lines
- `demo.py`: indexes a few short articles and runs example queries

---

## How to Run

```bash
python projects/20-mini-search/demo.py
```

---

## Design

The implementation stays intentionally small:

- `tokenize()` lowercases and splits text into terms
- `index[term][doc_id] = tf` stores the inverted index
- TF-IDF uses log-scaled term frequency and cosine normalization
- BM25 uses document length normalization through `avgdl`, `k1`, and `b`

This gives you two ranking strategies on top of the same index, which makes it easy to compare classic IR scoring methods.

---

## Notes

- This is a teaching implementation, not a production search engine.
- There is no stemming, stop-word filtering, phrase search, or incremental indexing.
- It is best for understanding the structure of lexical retrieval systems.
