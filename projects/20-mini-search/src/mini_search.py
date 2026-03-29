"""mini-search - inverted index, TF-IDF, and BM25 in under 200 lines."""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


class MiniSearch:
    def __init__(self, documents):
        self.docs = list(documents)
        self.index = defaultdict(dict)
        self.doc_len, self.doc_terms = {}, {}
        self.doc_freq, self.doc_norms = Counter(), {}
        self.N = len(self.docs)
        for doc in self.docs:
            terms = Counter(tokenize(doc["title"] + " " + doc["text"]))
            self.doc_terms[doc["id"]] = terms
            self.doc_len[doc["id"]] = sum(terms.values())
            for term, tf in terms.items():
                self.index[term][doc["id"]] = tf
                self.doc_freq[term] += 1
        self.avgdl = sum(self.doc_len.values()) / max(self.N, 1)
        self.doc_tfidf = {
            doc["id"]: {t: self.tfidf(t, tf) for t, tf in self.doc_terms[doc["id"]].items()}
            for doc in self.docs
        }
        self.doc_norms = {
            doc_id: math.sqrt(sum(w * w for w in weights.values())) or 1.0
            for doc_id, weights in self.doc_tfidf.items()
        }

    def idf(self, term):
        return math.log((self.N + 1) / (self.doc_freq[term] + 1)) + 1

    def tfidf(self, term, tf):
        return (1 + math.log(tf)) * self.idf(term)

    def bm25_idf(self, term):
        df = self.doc_freq[term]
        return math.log(1 + (self.N - df + 0.5) / (df + 0.5))

    def rank_tfidf(self, query, limit=5):
        q_terms = Counter(tokenize(query))
        q_vec = {t: self.tfidf(t, tf) for t, tf in q_terms.items() if t in self.doc_freq}
        q_norm = math.sqrt(sum(w * w for w in q_vec.values())) or 1.0
        scores = defaultdict(float)
        for term, q_weight in q_vec.items():
            for doc_id in self.index[term]:
                scores[doc_id] += q_weight * self.doc_tfidf[doc_id][term]
        return self._top(scores, limit, lambda d, s: s / (self.doc_norms[d] * q_norm))

    def rank_bm25(self, query, limit=5, k1=1.5, b=0.75):
        scores = defaultdict(float)
        for term in tokenize(query):
            if term not in self.doc_freq:
                continue
            idf = self.bm25_idf(term)
            for doc_id, tf in self.index[term].items():
                dl = self.doc_len[doc_id]
                denom = tf + k1 * (1 - b + b * dl / max(self.avgdl, 1))
                scores[doc_id] += idf * (tf * (k1 + 1)) / denom
        return self._top(scores, limit)

    def search(self, query, method="bm25", limit=5):
        ranker = self.rank_bm25 if method == "bm25" else self.rank_tfidf
        return ranker(query, limit=limit)

    def _top(self, scores, limit, normalize=lambda doc_id, score: score):
        by_id = {doc["id"]: doc for doc in self.docs}
        ranked = [
            {**by_id[doc_id], "score": round(normalize(doc_id, score), 4)}
            for doc_id, score in scores.items()
            if score > 0
        ]
        return sorted(ranked, key=lambda doc: (-doc["score"], doc["id"]))[:limit]
